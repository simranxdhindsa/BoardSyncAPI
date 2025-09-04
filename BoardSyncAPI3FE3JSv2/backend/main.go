package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

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

	// 🚫 Disable interactive mode on Render
	if os.Getenv("RENDER") == "" {
		go runInteractiveMode()
	}

	// Start HTTP server
	log.Fatal(http.ListenAndServe(":"+config.Port, nil))
}

func loadConfig() {
	// Load .env only for local dev
	if os.Getenv("RENDER") == "" {
		_ = godotenv.Load()
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // default for local dev
	}

	config = Config{
		Port:              port,
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
		log.Fatal("Missing required environment variables. Please check your env settings.")
	}

	loadIgnoredTickets()
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
