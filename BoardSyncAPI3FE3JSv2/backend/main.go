package main

import (
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

func main() {
	loadConfig()

	// Verify YouTrack connection
	projectKey, err := findYouTrackProject()
	if err != nil {
		log.Printf("Error with YouTrack project: %v", err)
		log.Println("Finding correct project...")
		listYouTrackProjects()
		return
	}

	if projectKey != config.YouTrackProjectID {
		log.Printf("Found correct project key: %s", projectKey)
		log.Printf("Please update your .env file:")
		log.Printf("   Change YOUTRACK_PROJECT_ID=%s", config.YouTrackProjectID)
		log.Printf("   To YOUTRACK_PROJECT_ID=%s", projectKey)
		log.Println("   Then restart the service.")
		return
	}

	log.Println("YouTrack connection verified!")

	// Setup HTTP handlers ONLY
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
	http.HandleFunc("/delete-tickets", deleteTicketsHandler)

	// Log startup info
	log.Printf("Enhanced Asana-YouTrack Sync Service v3.2")
	log.Printf("Server starting on port %s", config.Port)
	log.Printf("Service URL: https://boardsyncapi.onrender.com")
	log.Println("Service Status: READY - HTTP Server Only")
	log.Printf("Listening on port %s...", config.Port)

	// Start HTTP server - BLOCKING CALL ONLY
	log.Fatal(http.ListenAndServe(":"+config.Port, nil))
}

func loadConfig() {
	// Load .env only for local dev - Render uses environment variables
	if os.Getenv("RENDER") == "" {
		err := godotenv.Load()
		if err != nil {
			log.Println("Note: .env file not found, using environment variables")
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
		log.Fatal("Missing required environment variables. Please check your configuration:\n" +
			"   Required: ASANA_PAT, ASANA_PROJECT_ID, YOUTRACK_BASE_URL, YOUTRACK_TOKEN, YOUTRACK_PROJECT_ID")
	}

	// Load ignored tickets from file
	loadIgnoredTickets()

	log.Println("Configuration loaded successfully")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

//new
