package main

import (
	"bufio"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

func main() {
	loadConfig()
	fmt.Println("Starting Enhanced Asana-YouTrack Sync Service...")

	// Verify YouTrack connection
	fmt.Println("Verifying YouTrack connection...")
	projectKey, err := findYouTrackProject()
	if err != nil {
		fmt.Printf("Error with YouTrack project: %v\n", err)
		fmt.Println("Let's find your correct project...")
		listYouTrackProjects()
		return
	}

	if projectKey != config.YouTrackProjectID {
		fmt.Printf("Found correct project key: %s\n", projectKey)
		fmt.Printf("Please update your .env file:\n")
		fmt.Printf("   Change YOUTRACK_PROJECT_ID=%s\n", config.YouTrackProjectID)
		fmt.Printf("   To YOUTRACK_PROJECT_ID=%s\n", projectKey)
		fmt.Println("   Then restart the service.")
		return
	}

	fmt.Println("YouTrack connection verified!")

	// Setup HTTP handlers
	http.HandleFunc("/health", healthCheck)
	http.HandleFunc("/status", statusCheck)
	http.HandleFunc("/analyze", analyzeTicketsHandler)
	http.HandleFunc("/create-single", createSingleTicketHandler)
	http.HandleFunc("/create", createMissingTicketsHandler)
	http.HandleFunc("/sync", syncMismatchedTicketsHandler)
	http.HandleFunc("/ignore", manageIgnoredTicketsHandler)

	fmt.Printf("Server starting on port %s\n", config.Port)
	fmt.Println("Available endpoints:")
	fmt.Println("   GET  /health    - Health check")
	fmt.Println("   GET  /status    - Service status")
	fmt.Println("   GET  /analyze   - Analyze ticket differences")
	fmt.Println("   POST /create    - Create missing tickets")
	fmt.Println("   POST /create-single  - Create individual ticket")
	fmt.Println("   GET/POST /sync  - Sync mismatched tickets")
	fmt.Println("   GET/POST /ignore - Manage ignored tickets")

	// Start interactive mode in separate goroutine
	go runInteractiveMode()

	// Start HTTP server
	log.Fatal(http.ListenAndServe(":"+config.Port, nil))
}

func loadConfig() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	config = Config{
		Port:              getEnv("PORT", "8080"),
		SyncServiceAPIKey: getEnv("SYNC_SERVICE_API_KEY", ""),
		AsanaPAT:          getEnv("ASANA_PAT", ""),
		AsanaProjectID:    getEnv("ASANA_PROJECT_ID", ""),
		YouTrackBaseURL:   getEnv("YOUTRACK_BASE_URL", ""),
		YouTrackToken:     getEnv("YOUTRACK_TOKEN", ""),
		YouTrackProjectID: getEnv("YOUTRACK_PROJECT_ID", ""),
	}

	pollInterval, _ := strconv.Atoi(getEnv("POLL_INTERVAL_MS", "60000"))
	config.PollIntervalMS = pollInterval

	if config.AsanaPAT == "" || config.AsanaProjectID == "" ||
		config.YouTrackBaseURL == "" || config.YouTrackToken == "" ||
		config.YouTrackProjectID == "" {
		log.Fatal("Missing required environment variables. Please check your .env file.")
	}

	loadIgnoredTickets()
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func runInteractiveMode() {
	reader := bufio.NewReader(os.Stdin)
	time.Sleep(2 * time.Second)

	fmt.Println("\n" + strings.Repeat("=", 70))
	fmt.Println("INTERACTIVE MODE STARTED")
	fmt.Println("Choose which column to analyze and sync")
	fmt.Println(strings.Repeat("=", 70))

	for {
		selectedColumns := showColumnSelectionMenu(reader)
		if selectedColumns == nil {
			fmt.Println("Goodbye!")
			return
		}

		fmt.Printf("\nAnalyzing columns: %s\n", strings.Join(selectedColumns, ", "))
		fmt.Println("Fetching data...")

		analysis, err := performTicketAnalysis(selectedColumns)
		if err != nil {
			fmt.Printf("Error during analysis: %v\n", err)
			continue
		}

		displayAnalysisResults(analysis)

		// Handle high priority alerts first
		if len(analysis.FindingsAlerts) > 0 {
			fmt.Println("\nHIGH PRIORITY ALERTS - PLEASE REVIEW:")
			fmt.Println(strings.Repeat("!", 60))
			for i, alert := range analysis.FindingsAlerts {
				fmt.Printf("%d. %s\n", i+1, alert.AlertMessage)
				fmt.Printf("   YouTrack ID: %s\n", alert.YouTrackIssue.ID)
			}
			fmt.Println(strings.Repeat("!", 60))
		}

		// Interactive sync process
		if len(analysis.Mismatched) > 0 {
			fmt.Println("\nWould you like to start interactive sync? (y/n): ")
			input, _ := reader.ReadString('\n')
			if strings.TrimSpace(strings.ToLower(input)) == "y" {
				handleInteractiveSync(analysis.Mismatched, reader)
			}
		}

		// Create missing tickets
		if len(analysis.MissingYouTrack) > 0 {
			fmt.Printf("\nWould you like to create %d missing tickets in YouTrack? (y/n): ", len(analysis.MissingYouTrack))
			input, _ := reader.ReadString('\n')
			if strings.TrimSpace(strings.ToLower(input)) == "y" {
				handleCreateMissingTickets(analysis.MissingYouTrack)
			}
		}

		fmt.Println("\nActions:")
		fmt.Println("  [Enter] - Analyze again")
		fmt.Println("  [c] - Choose different column")
		fmt.Println("  [q] - Quit")
		fmt.Print("\nYour choice: ")

		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(strings.ToLower(input))

		if input == "q" || input == "quit" {
			fmt.Println("Interactive mode closed (server still running)")
			return
		}

		if input == "c" {
			continue // Go back to column selection
		}

		// Empty input (Enter) - analyze again with same columns
		if input == "" {
			continue
		}
	}
}

func showColumnSelectionMenu(reader *bufio.Reader) []string {
	for {
		fmt.Println("\nSelect column(s) to analyze:")
		fmt.Println("  1. Backlog only")
		fmt.Println("  2. In Progress only")
		fmt.Println("  3. DEV only")
		fmt.Println("  4. STAGE only")
		fmt.Println("  5. Blocked only")
		fmt.Println("  6. Ready for Stage only (display only)")
		fmt.Println("  7. Findings only (display only)")
		fmt.Println("  8. All syncable columns (1-5)")
		fmt.Println("  9. All columns (1-7)")
		fmt.Println("  0. Quit")

		fmt.Print("\nYour choice (0-9): ")
		input, _ := reader.ReadString('\n')
		choice := strings.TrimSpace(input)

		switch choice {
		case "0", "q", "quit":
			return nil
		case "1":
			return []string{"backlog"}
		case "2":
			return []string{"in progress"}
		case "3":
			return []string{"dev"}
		case "4":
			return []string{"stage"}
		case "5":
			return []string{"blocked"}
		case "6":
			return []string{"ready for stage"}
		case "7":
			return []string{"findings"}
		case "8":
			return syncableColumns
		case "9":
			return allColumns
		default:
			fmt.Println("Invalid choice. Please select 0-9.")
			continue
		}
	}
}

func displayAnalysisResults(analysis *TicketAnalysis) {
	fmt.Println("\n" + strings.Repeat("=", 70))
	fmt.Printf("ANALYSIS RESULTS - %s\n", strings.ToUpper(analysis.SelectedColumn))
	fmt.Println(strings.Repeat("=", 70))

	fmt.Printf("Matched: %d tickets\n", len(analysis.Matched))
	fmt.Printf("Mismatched: %d tickets\n", len(analysis.Mismatched))
	fmt.Printf("Missing in YouTrack: %d tickets\n", len(analysis.MissingYouTrack))

	if len(analysis.FindingsTickets) > 0 {
		fmt.Printf("Findings (display only): %d tickets\n", len(analysis.FindingsTickets))
	}

	if len(analysis.FindingsAlerts) > 0 {
		fmt.Printf("HIGH ALERTS: %d tickets\n", len(analysis.FindingsAlerts))
	}

	if len(analysis.ReadyForStage) > 0 {
		fmt.Printf("Ready for Stage (display only): %d tickets\n", len(analysis.ReadyForStage))
	}

	if len(analysis.BlockedTickets) > 0 {
		fmt.Printf("Blocked: %d tickets\n", len(analysis.BlockedTickets))
	}

	if len(analysis.OrphanedYouTrack) > 0 {
		fmt.Printf("Orphaned in YouTrack: %d tickets\n", len(analysis.OrphanedYouTrack))
	}

	if len(analysis.Ignored) > 0 {
		fmt.Printf("Ignored: %d tickets\n", len(analysis.Ignored))
	}

	// Show detailed mismatched tickets
	if len(analysis.Mismatched) > 0 {
		fmt.Println("\nMISMATCHED TICKETS:")
		fmt.Println(strings.Repeat("-", 50))
		for i, ticket := range analysis.Mismatched {
			fmt.Printf("%d. \"%s\"\n", i+1, ticket.AsanaTask.Name)
			fmt.Printf("   Asana: %s -> YouTrack: %s\n", ticket.AsanaStatus, ticket.YouTrackStatus)
		}
	}

	// Show missing tickets
	if len(analysis.MissingYouTrack) > 0 {
		fmt.Println("\nMISSING IN YOUTRACK:")
		fmt.Println(strings.Repeat("-", 50))
		for i, task := range analysis.MissingYouTrack {
			sectionName := getSectionName(task)
			fmt.Printf("%d. \"%s\" (Section: %s)\n", i+1, task.Name, sectionName)
		}
	}

	fmt.Println(strings.Repeat("=", 70))
}
