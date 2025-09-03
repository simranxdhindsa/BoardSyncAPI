package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port              string
	SyncServiceAPIKey string
	AsanaPAT          string
	AsanaProjectID    string
	YouTrackBaseURL   string
	YouTrackToken     string
	YouTrackProjectID string
	PollIntervalMS    int
}

type AsanaTask struct {
	GID         string `json:"gid"`
	Name        string `json:"name"`
	Notes       string `json:"notes"`
	CompletedAt string `json:"completed_at"`
	CreatedAt   string `json:"created_at"`
	ModifiedAt  string `json:"modified_at"`
	Memberships []struct {
		Section struct {
			GID  string `json:"gid"`
			Name string `json:"name"`
		} `json:"section"`
	} `json:"memberships"`
}

type AsanaResponse struct {
	Data []AsanaTask `json:"data"`
}

type YouTrackIssue struct {
	ID           string `json:"id"`
	Summary      string `json:"summary"`
	Description  string `json:"description"`
	Created      int64  `json:"created"`
	Updated      int64  `json:"updated"`
	CustomFields []struct {
		Name  string      `json:"name"`
		Value interface{} `json:"value"`
	} `json:"customFields"`
}

type TicketAnalysis struct {
	Matched          []MatchedTicket    `json:"matched"`
	Mismatched       []MismatchedTicket `json:"mismatched"`
	MissingYouTrack  []AsanaTask        `json:"missing_youtrack"`
	FindingsTickets  []AsanaTask        `json:"findings_tickets"`
	FindingsAlerts   []FindingsAlert    `json:"findings_alerts"`
	ReadyForStage    []AsanaTask        `json:"ready_for_stage"`
	BlockedTickets   []MatchedTicket    `json:"blocked_tickets"`
	OrphanedYouTrack []YouTrackIssue    `json:"orphaned_youtrack"`
	Ignored          []string           `json:"ignored"`
}

type MatchedTicket struct {
	AsanaTask     AsanaTask     `json:"asana_task"`
	YouTrackIssue YouTrackIssue `json:"youtrack_issue"`
	Status        string        `json:"status"`
}

type MismatchedTicket struct {
	AsanaTask      AsanaTask     `json:"asana_task"`
	YouTrackIssue  YouTrackIssue `json:"youtrack_issue"`
	AsanaStatus    string        `json:"asana_status"`
	YouTrackStatus string        `json:"youtrack_status"`
}

type FindingsAlert struct {
	AsanaTask      AsanaTask     `json:"asana_task"`
	YouTrackIssue  YouTrackIssue `json:"youtrack_issue"`
	YouTrackStatus string        `json:"youtrack_status"`
	AlertMessage   string        `json:"alert_message"`
}

type SyncRequest struct {
	TicketID string `json:"ticket_id"`
	Action   string `json:"action"`
}

type IgnoreRequest struct {
	TicketID string `json:"ticket_id"`
	Action   string `json:"action"`
	Type     string `json:"type"`
}

var config Config
var lastSyncTime time.Time
var ignoredTicketsTemp = make(map[string]bool)
var ignoredTicketsForever = make(map[string]bool)
var allowedColumns = []string{"backlog", "in progress", "dev", "stage", "blocked", "findings", "ready for stage"}
var syncableColumns = []string{"backlog", "in progress", "dev", "stage", "blocked"}
var displayOnlyColumns = []string{"findings", "ready for stage"}

func main() {
	loadConfig()
	fmt.Println("🚀 Starting Enhanced Asana-YouTrack Sync Service...")

	fmt.Println("🔍 Verifying YouTrack connection...")
	projectKey, err := findYouTrackProject()
	if err != nil {
		fmt.Printf("❌ Error with YouTrack project: %v\n", err)
		fmt.Println("💡 Let's find your correct project...")
		listYouTrackProjects()
		return
	}

	if projectKey != config.YouTrackProjectID {
		fmt.Printf("🔍 Found correct project key: %s\n", projectKey)
		fmt.Printf("💡 Please update your .env file:\n")
		fmt.Printf("   Change YOUTRACK_PROJECT_ID=%s\n", config.YouTrackProjectID)
		fmt.Printf("   To YOUTRACK_PROJECT_ID=%s\n", projectKey)
		fmt.Println("   Then restart the service.")
		return
	}

	fmt.Println("✅ YouTrack connection verified!")
	fmt.Printf("🎯 Syncable columns: %s\n", strings.Join(syncableColumns, ", "))
	fmt.Printf("📋 Display-only columns: %s\n", strings.Join(displayOnlyColumns, ", "))

	http.HandleFunc("/health", healthCheck)
	http.HandleFunc("/status", statusCheck)
	http.HandleFunc("/analyze", analyzeTickets)
	http.HandleFunc("/create", createMissingTickets)
	http.HandleFunc("/sync", syncMismatchedTickets)
	http.HandleFunc("/ignore", manageIgnoredTickets)

	fmt.Printf("🌐 Server starting on port %s\n", config.Port)
	fmt.Println("\n📍 Available endpoints:")
	fmt.Println("   GET  /health    - Health check")
	fmt.Println("   GET  /status    - Service status")
	fmt.Println("   GET  /analyze   - Analyze ticket differences")
	fmt.Println("   POST /create    - Create missing tickets")
	fmt.Println("   GET/POST /sync  - Sync mismatched tickets")
	fmt.Println("   GET/POST /ignore - Manage ignored tickets")

	go runInteractiveMode()
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

	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Println("🎮 INTERACTIVE MODE AVAILABLE")
	fmt.Println("   Press Enter for quick analysis, 'quit' to exit")
	fmt.Println(strings.Repeat("=", 60))

	for {
		fmt.Print("\n➤ ")
		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(input)

		if input == "quit" || input == "q" || input == "exit" {
			fmt.Println("👋 Interactive mode closed (server still running)")
			return
		}

		if input == "" {
			analysis, err := performTicketAnalysis()
			if err != nil {
				fmt.Printf("❌ Error: %v\n", err)
				continue
			}
			displayAnalysisResults(analysis)
		}
	}
}

func analyzeTickets(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed. Use GET.", http.StatusMethodNotAllowed)
		return
	}

	analysis, err := performTicketAnalysis()
	if err != nil {
		http.Error(w, fmt.Sprintf("Analysis failed: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "success",
		"timestamp": time.Now().Format(time.RFC3339),
		"analysis":  analysis,
		"summary": map[string]int{
			"matched":           len(analysis.Matched),
			"mismatched":        len(analysis.Mismatched),
			"missing_youtrack":  len(analysis.MissingYouTrack),
			"findings_tickets":  len(analysis.FindingsTickets),
			"findings_alerts":   len(analysis.FindingsAlerts),
			"ready_for_stage":   len(analysis.ReadyForStage),
			"blocked_tickets":   len(analysis.BlockedTickets),
			"orphaned_youtrack": len(analysis.OrphanedYouTrack),
			"ignored":           len(analysis.Ignored),
		},
	})
}

func createMissingTickets(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" && r.Method != "GET" {
		http.Error(w, "Method not allowed. Use POST or GET.", http.StatusMethodNotAllowed)
		return
	}

	analysis, err := performTicketAnalysis()
	if err != nil {
		http.Error(w, fmt.Sprintf("Analysis failed: %v", err), http.StatusInternalServerError)
		return
	}

	if len(analysis.MissingYouTrack) == 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "success",
			"message": "No missing tickets to create",
			"created": 0,
		})
		return
	}

	results := []map[string]interface{}{}
	created := 0

	for _, task := range analysis.MissingYouTrack {
		err := createYouTrackIssue(task)
		result := map[string]interface{}{
			"task_id":   task.GID,
			"task_name": task.Name,
		}

		if err != nil {
			result["status"] = "failed"
			result["error"] = err.Error()
		} else {
			result["status"] = "created"
			created++
		}
		results = append(results, result)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "completed",
		"created": created,
		"total":   len(analysis.MissingYouTrack),
		"results": results,
	})
}

func syncMismatchedTickets(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method == "GET" {
		analysis, err := performTicketAnalysis()
		if err != nil {
			http.Error(w, fmt.Sprintf("Analysis failed: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":     "success",
			"message":    "Mismatched tickets available for sync",
			"count":      len(analysis.Mismatched),
			"mismatched": analysis.Mismatched,
			"usage": map[string]string{
				"sync_all":       "POST with [{\"ticket_id\":\"ID\",\"action\":\"sync\"}] for each ticket",
				"ignore_temp":    "POST with [{\"ticket_id\":\"ID\",\"action\":\"ignore_temp\"}]",
				"ignore_forever": "POST with [{\"ticket_id\":\"ID\",\"action\":\"ignore_forever\"}]",
			},
		})
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed. Use GET to see available tickets, POST to sync.", http.StatusMethodNotAllowed)
		return
	}

	var requests []SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&requests); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":         "Invalid JSON format",
			"expected":      "Array of objects like: [{\"ticket_id\":\"123\",\"action\":\"sync\"}]",
			"valid_actions": []string{"sync", "ignore_temp", "ignore_forever"},
			"example":       `[{"ticket_id":"1234567890","action":"sync"}]`,
		})
		return
	}

	analysis, err := performTicketAnalysis()
	if err != nil {
		http.Error(w, fmt.Sprintf("Analysis failed: %v", err), http.StatusInternalServerError)
		return
	}

	mismatchMap := make(map[string]MismatchedTicket)
	for _, ticket := range analysis.Mismatched {
		mismatchMap[ticket.AsanaTask.GID] = ticket
	}

	results := []map[string]interface{}{}
	synced := 0

	for _, req := range requests {
		result := map[string]interface{}{
			"ticket_id": req.TicketID,
			"action":    req.Action,
		}

		ticket, exists := mismatchMap[req.TicketID]
		if !exists {
			result["status"] = "failed"
			result["error"] = "Ticket not found in mismatched list"
			results = append(results, result)
			continue
		}

		switch req.Action {
		case "sync":
			err := updateYouTrackIssue(ticket.YouTrackIssue.ID, ticket.AsanaTask)
			if err != nil {
				result["status"] = "failed"
				result["error"] = err.Error()
			} else {
				result["status"] = "synced"
				result["from"] = ticket.YouTrackStatus
				result["to"] = ticket.AsanaStatus
				synced++
			}

		case "ignore_temp":
			ignoredTicketsTemp[req.TicketID] = true
			result["status"] = "ignored_temporarily"

		case "ignore_forever":
			ignoredTicketsForever[req.TicketID] = true
			saveIgnoredTickets()
			result["status"] = "ignored_permanently"

		default:
			result["status"] = "failed"
			result["error"] = "Invalid action"
		}

		results = append(results, result)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "completed",
		"synced":  synced,
		"total":   len(requests),
		"results": results,
	})
}

func manageIgnoredTickets(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"temp_ignored":    getMapKeys(ignoredTicketsTemp),
			"forever_ignored": getMapKeys(ignoredTicketsForever),
		})

	case "POST":
		var req IgnoreRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		switch req.Action {
		case "add":
			if req.Type == "forever" {
				ignoredTicketsForever[req.TicketID] = true
				saveIgnoredTickets()
			} else {
				ignoredTicketsTemp[req.TicketID] = true
			}

		case "remove":
			if req.Type == "forever" {
				delete(ignoredTicketsForever, req.TicketID)
				saveIgnoredTickets()
			} else {
				delete(ignoredTicketsTemp, req.TicketID)
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "success",
			"action": req.Action,
			"type":   req.Type,
		})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func performTicketAnalysis() (*TicketAnalysis, error) {
	allAsanaTasks, err := getAsanaTasks()
	if err != nil {
		return nil, fmt.Errorf("failed to get Asana tasks: %v", err)
	}

	asanaTasks := filterAsanaTasksByColumn(allAsanaTasks)

	youTrackIssues, err := getYouTrackIssues()
	if err != nil {
		return nil, fmt.Errorf("failed to get YouTrack issues: %v", err)
	}

	youTrackMap := make(map[string]YouTrackIssue)
	asanaMap := make(map[string]AsanaTask)

	for _, issue := range youTrackIssues {
		asanaID := extractAsanaID(issue)
		if asanaID != "" {
			youTrackMap[asanaID] = issue
		}
	}

	for _, task := range asanaTasks {
		asanaMap[task.GID] = task
	}

	analysis := &TicketAnalysis{
		Matched:          []MatchedTicket{},
		Mismatched:       []MismatchedTicket{},
		MissingYouTrack:  []AsanaTask{},
		FindingsTickets:  []AsanaTask{},
		FindingsAlerts:   []FindingsAlert{},
		ReadyForStage:    []AsanaTask{},
		BlockedTickets:   []MatchedTicket{},
		OrphanedYouTrack: []YouTrackIssue{},
		Ignored:          getMapKeys(ignoredTicketsForever),
	}

	for _, task := range asanaTasks {
		if isIgnored(task.GID) {
			continue
		}

		sectionName := ""
		if len(task.Memberships) > 0 {
			sectionName = strings.ToLower(task.Memberships[0].Section.Name)
		}

		if strings.Contains(sectionName, "findings") {
			analysis.FindingsTickets = append(analysis.FindingsTickets, task)

			if existingIssue, exists := youTrackMap[task.GID]; exists {
				youtrackStatus := getYouTrackStatus(existingIssue)
				analysis.FindingsAlerts = append(analysis.FindingsAlerts, FindingsAlert{
					AsanaTask:      task,
					YouTrackIssue:  existingIssue,
					YouTrackStatus: youtrackStatus,
					AlertMessage:   fmt.Sprintf("🚨 HIGH ALERT: Ticket '%s' is in Findings (Asana) but still active in YouTrack (%s)", task.Name, youtrackStatus),
				})
			}
			continue
		}

		if strings.Contains(sectionName, "ready for stage") {
			analysis.ReadyForStage = append(analysis.ReadyForStage, task)
			continue
		}

		if existingIssue, exists := youTrackMap[task.GID]; exists {
			asanaStatus := mapAsanaStateToYouTrack(task)
			youtrackStatus := getYouTrackStatus(existingIssue)

			if strings.Contains(sectionName, "blocked") {
				analysis.BlockedTickets = append(analysis.BlockedTickets, MatchedTicket{
					AsanaTask:     task,
					YouTrackIssue: existingIssue,
					Status:        asanaStatus,
				})
			} else if asanaStatus == youtrackStatus {
				analysis.Matched = append(analysis.Matched, MatchedTicket{
					AsanaTask:     task,
					YouTrackIssue: existingIssue,
					Status:        asanaStatus,
				})
			} else {
				analysis.Mismatched = append(analysis.Mismatched, MismatchedTicket{
					AsanaTask:      task,
					YouTrackIssue:  existingIssue,
					AsanaStatus:    asanaStatus,
					YouTrackStatus: youtrackStatus,
				})
			}
		} else {
			if isSyncableColumn(sectionName) {
				analysis.MissingYouTrack = append(analysis.MissingYouTrack, task)
			}
		}
	}

	for _, issue := range youTrackIssues {
		asanaID := extractAsanaID(issue)
		if asanaID != "" {
			if _, exists := asanaMap[asanaID]; !exists {
				analysis.OrphanedYouTrack = append(analysis.OrphanedYouTrack, issue)
			}
		}
	}

	return analysis, nil
}

func filterAsanaTasksByColumn(tasks []AsanaTask) []AsanaTask {
	filtered := []AsanaTask{}
	for _, task := range tasks {
		if len(task.Memberships) > 0 {
			sectionName := strings.ToLower(task.Memberships[0].Section.Name)
			for _, allowedCol := range allowedColumns {
				if strings.Contains(sectionName, strings.ToLower(allowedCol)) {
					filtered = append(filtered, task)
					break
				}
			}
		}
	}
	return filtered
}

func isSyncableColumn(sectionName string) bool {
	sectionLower := strings.ToLower(sectionName)
	for _, col := range syncableColumns {
		if strings.Contains(sectionLower, strings.ToLower(col)) {
			return true
		}
	}
	return false
}

func displayAnalysisResults(analysis *TicketAnalysis) {
	fmt.Println("\n" + strings.Repeat("=", 70))
	fmt.Println("📊 TICKET ANALYSIS RESULTS")
	fmt.Println(strings.Repeat("=", 70))

	fmt.Printf("🎯 Syncable columns: %s\n", strings.Join(syncableColumns, ", "))
	fmt.Printf("📋 Display-only columns: %s\n\n", strings.Join(displayOnlyColumns, ", "))

	fmt.Printf("✅ MATCHED: %d tickets\n", len(analysis.Matched))
	fmt.Printf("⚠️  MISMATCHED: %d tickets\n", len(analysis.Mismatched))
	fmt.Printf("➕ MISSING IN YOUTRACK: %d tickets\n", len(analysis.MissingYouTrack))
	fmt.Printf("🔍 FINDINGS (display only): %d tickets\n", len(analysis.FindingsTickets))
	fmt.Printf("🚨 FINDINGS ALERTS: %d tickets\n", len(analysis.FindingsAlerts))
	fmt.Printf("📤 READY FOR STAGE (display only): %d tickets\n", len(analysis.ReadyForStage))
	fmt.Printf("🚫 BLOCKED: %d tickets\n", len(analysis.BlockedTickets))
	fmt.Printf("❓ ORPHANED IN YOUTRACK: %d tickets\n", len(analysis.OrphanedYouTrack))
	fmt.Printf("🚫 IGNORED: %d tickets\n", len(analysis.Ignored))

	if len(analysis.FindingsAlerts) > 0 {
		fmt.Println("\n🚨 HIGH PRIORITY FINDINGS ALERTS:")
		fmt.Println(strings.Repeat("!", 60))
		for i, alert := range analysis.FindingsAlerts {
			fmt.Printf("%d. %s\n", i+1, alert.AlertMessage)
			fmt.Printf("   YouTrack ID: %s (Status: %s)\n", alert.YouTrackIssue.ID, alert.YouTrackStatus)
		}
		fmt.Println(strings.Repeat("!", 60))
	}

	if len(analysis.Mismatched) > 0 {
		fmt.Println("\n⚠️  MISMATCHED TICKETS:")
		fmt.Println(strings.Repeat("-", 50))
		for i, ticket := range analysis.Mismatched {
			fmt.Printf("%d. 📝 %s\n", i+1, ticket.AsanaTask.Name)
			fmt.Printf("   Asana: %s → YouTrack: %s\n", ticket.AsanaStatus, ticket.YouTrackStatus)
		}
	}

	if len(analysis.MissingYouTrack) > 0 {
		fmt.Println("\n➕ MISSING IN YOUTRACK:")
		fmt.Println(strings.Repeat("-", 50))
		for i, task := range analysis.MissingYouTrack {
			sectionName := "No Section"
			if len(task.Memberships) > 0 {
				sectionName = task.Memberships[0].Section.Name
			}
			fmt.Printf("%d. 📝 %s (Section: %s)\n", i+1, task.Name, sectionName)
		}
	}

	fmt.Println(strings.Repeat("=", 70))
}

func isIgnored(ticketID string) bool {
	return ignoredTicketsTemp[ticketID] || ignoredTicketsForever[ticketID]
}

func getMapKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func loadIgnoredTickets() {
	data, err := os.ReadFile("ignored_tickets.json")
	if err != nil {
		return
	}

	var ignored []string
	if err := json.Unmarshal(data, &ignored); err != nil {
		return
	}

	for _, id := range ignored {
		ignoredTicketsForever[id] = true
	}
}

func saveIgnoredTickets() {
	ignored := getMapKeys(ignoredTicketsForever)
	data, _ := json.MarshalIndent(ignored, "", "  ")
	os.WriteFile("ignored_tickets.json", data, 0644)
}

func getYouTrackStatus(issue YouTrackIssue) string {
	for _, field := range issue.CustomFields {
		if field.Name == "State" {
			switch value := field.Value.(type) {
			case map[string]interface{}:
				if name, ok := value["name"].(string); ok && name != "" {
					return name
				}
				if name, ok := value["localizedName"].(string); ok && name != "" {
					return name
				}
			case string:
				return value
			case nil:
				return "No State"
			}
		}
	}
	return "Unknown"
}

func getAsanaTasks() ([]AsanaTask, error) {
	url := fmt.Sprintf("https://app.asana.com/api/1.0/projects/%s/tasks?opt_fields=gid,name,notes,completed_at,created_at,modified_at,memberships.section.gid,memberships.section.name", config.AsanaProjectID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+config.AsanaPAT)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Asana API error: %d - %s", resp.StatusCode, string(body))
	}

	var asanaResp AsanaResponse
	if err := json.NewDecoder(resp.Body).Decode(&asanaResp); err != nil {
		return nil, err
	}

	return asanaResp.Data, nil
}

func getYouTrackIssues() ([]YouTrackIssue, error) {
	fmt.Printf("🌐 Connecting to YouTrack Cloud: %s\n", config.YouTrackBaseURL)
	fmt.Printf("🎯 Looking for project: %s\n", config.YouTrackProjectID)

	approaches := []func() ([]YouTrackIssue, error){
		getYouTrackIssuesWithQuery,
		getYouTrackIssuesSimpleCloud,
		getYouTrackIssuesViaProjects,
	}

	for i, approach := range approaches {
		fmt.Printf("🔄 Attempting approach %d...\n", i+1)
		issues, err := approach()
		if err == nil && len(issues) >= 0 {
			fmt.Printf("✅ Approach %d succeeded! Found %d issues\n", i+1, len(issues))
			return issues, nil
		}
		fmt.Printf("❌ Approach %d failed: %v\n", i+1, err)
	}

	return nil, fmt.Errorf("all approaches failed to connect to YouTrack Cloud")
}

func getYouTrackIssuesWithQuery() ([]YouTrackIssue, error) {
	queries := []string{
		fmt.Sprintf("project:%s", config.YouTrackProjectID),
		fmt.Sprintf("project: %s", config.YouTrackProjectID),
		fmt.Sprintf("#%s", config.YouTrackProjectID),
	}

	fields := "id,summary,description,created,updated,customFields(name,value)"

	for i, query := range queries {
		fmt.Printf("   🔍 Query format %d: %s\n", i+1, query)

		encodedQuery := strings.ReplaceAll(query, " ", "%20")
		url := fmt.Sprintf("%s/api/issues?fields=%s&query=%s&top=200",
			config.YouTrackBaseURL, fields, encodedQuery)

		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			continue
		}

		req.Header.Set("Authorization", "Bearer "+config.YouTrackToken)
		req.Header.Set("Accept", "application/json")
		req.Header.Set("Cache-Control", "no-cache")

		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			fmt.Printf("   ❌ Network error: %v\n", err)
			continue
		}

		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		fmt.Printf("   📡 Status: %d\n", resp.StatusCode)

		if resp.StatusCode == http.StatusOK {
			var issues []YouTrackIssue
			if err := json.Unmarshal(body, &issues); err != nil {
				fmt.Printf("   ❌ JSON error: %v\n", err)
				continue
			}
			return issues, nil
		}
	}

	return nil, fmt.Errorf("query approach failed")
}

func getYouTrackIssuesSimpleCloud() ([]YouTrackIssue, error) {
	fmt.Println("   🔍 Trying simple issues endpoint...")

	url := fmt.Sprintf("%s/api/issues?fields=id,summary,description,created,updated,customFields(name,value),project(shortName)&top=200",
		config.YouTrackBaseURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+config.YouTrackToken)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("network error: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("   📡 Status: %d\n", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		bodyStr := string(body)
		if len(bodyStr) > 300 {
			bodyStr = bodyStr[:300] + "..."
		}
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, bodyStr)
	}

	var allIssues []struct {
		YouTrackIssue
		Project struct {
			ShortName string `json:"shortName"`
		} `json:"project"`
	}

	if err := json.Unmarshal(body, &allIssues); err != nil {
		return nil, fmt.Errorf("JSON parsing error: %v", err)
	}

	var projectIssues []YouTrackIssue
	fmt.Printf("   🔍 Filtering %d total issues for project '%s'\n", len(allIssues), config.YouTrackProjectID)

	for _, issue := range allIssues {
		if issue.Project.ShortName == config.YouTrackProjectID {
			projectIssues = append(projectIssues, issue.YouTrackIssue)
		}
	}

	return projectIssues, nil
}

func getYouTrackIssuesViaProjects() ([]YouTrackIssue, error) {
	fmt.Println("   🔍 Trying project-specific endpoint...")

	url := fmt.Sprintf("%s/api/admin/projects/%s/issues?fields=id,summary,description,created,updated,customFields(name,value)&top=200",
		config.YouTrackBaseURL, config.YouTrackProjectID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+config.YouTrackToken)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("network error: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("   📡 Status: %d\n", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("project endpoint failed with status %d", resp.StatusCode)
	}

	var issues []YouTrackIssue
	if err := json.Unmarshal(body, &issues); err != nil {
		return nil, fmt.Errorf("JSON parsing error: %v", err)
	}

	return issues, nil
}

func findYouTrackProject() (string, error) {
	fmt.Println("🔗 Testing YouTrack Cloud connection...")
	fmt.Printf("🌐 URL: %s\n", config.YouTrackBaseURL)
	fmt.Printf("🎯 Project: %s\n", config.YouTrackProjectID)

	url := fmt.Sprintf("%s/api/admin/projects?fields=id,name,shortName&top=10", config.YouTrackBaseURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+config.YouTrackToken)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Cache-Control", "no-cache")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("connection failed: %v", err)
	}
	defer resp.Body.Close()

	fmt.Printf("📡 Response status: %d\n", resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		fmt.Println("🔄 Trying alternative projects endpoint...")
		return findYouTrackProjectAlternative()
	}

	var projects []struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		ShortName string `json:"shortName"`
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&projects); err != nil {
		fmt.Printf("❌ JSON decode error: %v\n", err)
		return "", err
	}

	fmt.Printf("✅ Found %d projects\n", len(projects))

	for _, proj := range projects {
		if proj.ID == config.YouTrackProjectID || proj.ShortName == config.YouTrackProjectID {
			fmt.Printf("✅ Found matching project: %s (%s)\n", proj.Name, proj.ShortName)
			return proj.ShortName, nil
		}
	}

	return "", fmt.Errorf("project '%s' not found", config.YouTrackProjectID)
}

func findYouTrackProjectAlternative() (string, error) {
	url := fmt.Sprintf("%s/api/projects?fields=id,name,shortName", config.YouTrackBaseURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+config.YouTrackToken)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("alternative connection failed: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("📡 Alternative endpoint status: %d\n", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("alternative endpoint failed: %d", resp.StatusCode)
	}

	var projects []struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		ShortName string `json:"shortName"`
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&projects); err != nil {
		return "", fmt.Errorf("JSON decode error: %v", err)
	}

	fmt.Printf("✅ Alternative endpoint found %d projects\n", len(projects))

	for _, proj := range projects {
		if proj.ID == config.YouTrackProjectID || proj.ShortName == config.YouTrackProjectID {
			fmt.Printf("✅ Found project: %s (%s)\n", proj.Name, proj.ShortName)
			return proj.ShortName, nil
		}
	}

	return "", fmt.Errorf("project '%s' not found in %d available projects", config.YouTrackProjectID, len(projects))
}

func listYouTrackProjects() {
	fmt.Println("🔍 Let me list all available projects...")

	url := fmt.Sprintf("%s/api/admin/projects?fields=id,name,shortName&top=20", config.YouTrackBaseURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Printf("❌ Error creating request: %v\n", err)
		return
	}

	req.Header.Set("Authorization", "Bearer "+config.YouTrackToken)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Cache-Control", "no-cache")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("❌ Error connecting to YouTrack: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("📡 Projects API Response Status: %d\n", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("❌ Raw response: %s\n", string(body))
		return
	}

	var projects []struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		ShortName string `json:"shortName"`
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&projects); err != nil {
		fmt.Printf("❌ Error parsing JSON: %v\n", err)
		fmt.Printf("❌ Response was: %s\n", string(body))
		return
	}

	if len(projects) == 0 {
		fmt.Println("❌ No projects found - check your token permissions")
		return
	}

	fmt.Printf("📋 Found %d projects:\n\n", len(projects))
	for i, proj := range projects {
		fmt.Printf("   %d. Name: %s\n", i+1, proj.Name)
		fmt.Printf("      Key: %s (use this in .env)\n", proj.ShortName)
		fmt.Printf("      ID: %s\n\n", proj.ID)
	}

	fmt.Println("💡 Copy one of the 'Key' values above and update your .env file:")
	fmt.Printf("   YOUTRACK_PROJECT_ID=<paste_key_here>\n")
}

func createYouTrackIssue(task AsanaTask) error {
	state := mapAsanaStateToYouTrack(task)

	if state == "FINDINGS_NO_SYNC" || state == "READY_FOR_STAGE_NO_SYNC" {
		return fmt.Errorf("cannot create ticket for display-only column")
	}

	payload := map[string]interface{}{
		"$type":       "Issue",
		"summary":     task.Name,
		"description": fmt.Sprintf("%s\n\n[Synced from Asana ID: %s]", task.Notes, task.GID),
		"project": map[string]interface{}{
			"$type":     "Project",
			"shortName": config.YouTrackProjectID,
		},
	}

	if state != "" {
		payload["customFields"] = []map[string]interface{}{
			{
				"$type": "StateIssueCustomField",
				"name":  "State",
				"value": map[string]interface{}{
					"$type": "StateBundleElement",
					"name":  state,
				},
			},
		}
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/api/issues", config.YouTrackBaseURL)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+config.YouTrackToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("YouTrack create error: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

func updateYouTrackIssue(issueID string, task AsanaTask) error {
	state := mapAsanaStateToYouTrack(task)

	if state == "FINDINGS_NO_SYNC" || state == "READY_FOR_STAGE_NO_SYNC" {
		return fmt.Errorf("cannot update ticket for display-only column")
	}

	payload := map[string]interface{}{
		"summary":     task.Name,
		"description": fmt.Sprintf("%s\n\n[Synced from Asana ID: %s]", task.Notes, task.GID),
	}

	if state != "" {
		payload["customFields"] = []map[string]interface{}{
			{
				"name":  "State",
				"value": map[string]string{"name": state},
			},
		}
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/api/issues/%s", config.YouTrackBaseURL, issueID)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+config.YouTrackToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("YouTrack update error: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

func mapAsanaStateToYouTrack(task AsanaTask) string {
	if len(task.Memberships) == 0 {
		return "Backlog"
	}

	sectionName := strings.ToLower(task.Memberships[0].Section.Name)

	switch {
	case strings.Contains(sectionName, "backlog"):
		return "Backlog"
	case strings.Contains(sectionName, "in progress"):
		return "In Progress"
	case strings.Contains(sectionName, "dev"):
		return "DEV"
	case strings.Contains(sectionName, "stage") && !strings.Contains(sectionName, "ready"):
		return "STAGE"
	case strings.Contains(sectionName, "blocked"):
		return "Blocked"
	case strings.Contains(sectionName, "findings"):
		return "FINDINGS_NO_SYNC"
	case strings.Contains(sectionName, "ready for stage"):
		return "READY_FOR_STAGE_NO_SYNC"
	default:
		return "Backlog"
	}
}

func extractAsanaID(issue YouTrackIssue) string {
	if strings.Contains(issue.Description, "Asana ID:") {
		lines := strings.Split(issue.Description, "\n")
		for _, line := range lines {
			if strings.Contains(line, "Asana ID:") {
				parts := strings.Split(line, "Asana ID:")
				if len(parts) > 1 {
					return strings.TrimSpace(strings.Trim(parts[1], "]"))
				}
			}
		}
	}
	return ""
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"service":   "enhanced-asana-youtrack-sync",
		"timestamp": time.Now().Format(time.RFC3339),
		"version":   "2.0",
		"filtered_columns": map[string]interface{}{
			"syncable":     syncableColumns,
			"display_only": displayOnlyColumns,
		},
	})
}

func statusCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service":          "enhanced-asana-youtrack-sync",
		"last_sync":        lastSyncTime.Format(time.RFC3339),
		"poll_interval":    config.PollIntervalMS,
		"asana_project":    config.AsanaProjectID,
		"youtrack_project": config.YouTrackProjectID,
		"filtered_columns": map[string]interface{}{
			"syncable":     syncableColumns,
			"display_only": displayOnlyColumns,
		},
		"temp_ignored":    len(ignoredTicketsTemp),
		"forever_ignored": len(ignoredTicketsForever),
		"endpoints": []string{
			"GET /health - Health check",
			"GET /status - Service status",
			"GET /analyze - Analyze ticket differences",
			"POST /create - Create missing tickets",
			"GET/POST /sync - Sync mismatched tickets",
			"GET/POST /ignore - Manage ignored tickets",
		},
	})
}
