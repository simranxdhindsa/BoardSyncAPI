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
	http.HandleFunc("/auto-sync", autoSyncHandler)
	http.HandleFunc("/auto-create", autoCreateHandler)
	http.HandleFunc("/tickets", getTicketsByTypeHandler)

	// Print service information
	fmt.Printf("Enhanced Asana-YouTrack Sync Service v3.2\n")
	fmt.Printf("Server starting on port %s\n", config.Port)
	fmt.Printf("Service URL: https://boardsyncapi.onrender.com (or http://localhost:%s locally)\n", config.Port)
	fmt.Println("")
	fmt.Println("🚀 Enhanced Sync Features:")
	fmt.Println("   ✅ Status/State synchronization")
	fmt.Println("   ✅ Title/Name synchronization")
	fmt.Println("   ✅ Description/Notes synchronization")
	fmt.Println("   ✅ Tags/Subsystem synchronization")
	fmt.Println("")
	fmt.Println("📡 Available API endpoints:")
	fmt.Println("   GET  /health          - Health check")
	fmt.Println("   GET  /status          - Service status")
	fmt.Println("   GET  /analyze         - Analyze ticket differences")
	fmt.Println("   POST /create          - Create missing tickets (bulk)")
	fmt.Println("   POST /create-single   - Create individual ticket")
	fmt.Println("   GET/POST /sync        - Sync mismatched tickets (comprehensive)")
	fmt.Println("   GET/POST /ignore      - Manage ignored tickets")
	fmt.Println("   GET/POST /auto-sync   - Control auto-sync functionality")
	fmt.Println("   GET/POST /auto-create - Control auto-create functionality")
	fmt.Println("   GET  /tickets         - Get tickets by type")
	fmt.Println("")
	fmt.Println("🌐 Web Interface:")
	fmt.Println("   Frontend: https://asana-youtrack-sync-frontend.netlify.app")
	fmt.Println("   (or your configured frontend URL)")
	fmt.Println("")
	fmt.Println("🔄 Auto-Sync Features:")
	fmt.Println("   - Automatic status synchronization")
	fmt.Println("   - Automatic title synchronization")
	fmt.Println("   - Automatic description synchronization")
	fmt.Println("   - Automatic tags synchronization")
	fmt.Println("")
	fmt.Println("🚦 Service Status: READY")
	fmt.Println("💡 Tip: Use the web interface for easy management")
	fmt.Println("")
	fmt.Printf("🎯 Listening on port %s...\n", config.Port)

	// Start HTTP server (blocking call)
	log.Fatal(http.ListenAndServe(":"+config.Port, nil))
}

func loadConfig() {
	// Load .env only for local dev - Render uses environment variables
	if os.Getenv("RENDER") == "" {
		err := godotenv.Load()
		if err != nil {
			fmt.Println("Note: .env file not found, using environment variables")
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
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

	pollInterval, err := strconv.Atoi(getEnv("POLL_INTERVAL_MS", "60000"))
	if err != nil {
		pollInterval = 60000 // default
	}
	config.PollIntervalMS = pollInterval

	// Validate required environment variables
	if config.AsanaPAT == "" || config.AsanaProjectID == "" ||
		config.YouTrackBaseURL == "" || config.YouTrackToken == "" ||
		config.YouTrackProjectID == "" {
		log.Fatal("❌ Missing required environment variables. Please check your configuration:\n" +
			"   Required: ASANA_PAT, ASANA_PROJECT_ID, YOUTRACK_BASE_URL, YOUTRACK_TOKEN, YOUTRACK_PROJECT_ID")
	}

	// Load ignored tickets from file
	loadIgnoredTickets()

	fmt.Println("✅ Configuration loaded successfully")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
