// main.go
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

type YouTrackResponse struct {
	Issues []YouTrackIssue `json:"issues"`
}

type SyncAction struct {
	Type        string // "CREATE", "UPDATE", "DELETE"
	AsanaTask   AsanaTask
	YouTrackID  string
	Description string
}

var config Config
var lastSyncTime time.Time

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

	// Validate required fields
	if config.AsanaPAT == "" || config.AsanaProjectID == "" ||
		config.YouTrackBaseURL == "" || config.YouTrackToken == "" ||
		config.YouTrackProjectID == "" {
		log.Fatal("Missing required environment variables. Please check your .env file.")
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func main() {
	loadConfig()
	fmt.Println("🚀 Starting Asana-YouTrack Sync Service...")

	// First, let's verify and find the correct project ID
	fmt.Println("🔍 Verifying YouTrack connection...")
	projectKey, err := findYouTrackProject()
	if err != nil {
		fmt.Printf("❌ Error with YouTrack project: %v\n", err)
		fmt.Println("💡 Let's find your correct project...")
		listYouTrackProjects()
		return
	}

	if projectKey != config.YouTrackProjectID {
		fmt.Printf("📝 Found correct project key: %s\n", projectKey)
		fmt.Printf("💡 Please update your .env file:\n")
		fmt.Printf("   Change YOUTRACK_PROJECT_ID=%s\n", config.YouTrackProjectID)
		fmt.Printf("   To YOUTRACK_PROJECT_ID=%s\n", projectKey)
		fmt.Println("   Then restart the service.")
		return
	}

	fmt.Println("✅ YouTrack connection verified!")
	fmt.Println("📋 This service syncs FROM Asana TO YouTrack only")
	fmt.Println("🔄 Starting manual sync mode...")

	// Start manual sync instead of automatic polling
	runManualSync()
}

func runManualSync() {
	reader := bufio.NewReader(os.Stdin)

	for {
		fmt.Println("\n" + strings.Repeat("=", 50))
		fmt.Println("🔄 MANUAL SYNC MODE")
		fmt.Println("📋 Press Enter to check for Asana changes, or type 'quit' to exit")
		fmt.Print("➤ ")

		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(input)

		if input == "quit" || input == "q" || input == "exit" {
			fmt.Println("👋 Goodbye!")
			break
		}

		fmt.Println("\n🔍 Scanning Asana for all tasks...")

		// Get all Asana tasks (ignore timing, show everything)
		asanaTasks, err := getAsanaTasks()
		if err != nil {
			fmt.Printf("❌ Error getting Asana tasks: %v\n", err)
			continue
		}

		if len(asanaTasks) == 0 {
			fmt.Println("📭 No tasks found in Asana project")
			continue
		}

		fmt.Printf("📋 Found %d tasks in Asana\n", len(asanaTasks))

		// Get YouTrack issues for comparison
		youTrackIssues, err := getYouTrackIssues()
		if err != nil {
			fmt.Printf("❌ Error getting YouTrack issues: %v\n", err)
			youTrackIssues = []YouTrackIssue{} // Continue with empty list
		}

		// Show all tasks and let user choose what to sync
		showTasksForSync(asanaTasks, youTrackIssues)
	}
}

func showTasksForSync(asanaTasks []AsanaTask, youTrackIssues []YouTrackIssue) {
	// Create map of existing YouTrack issues
	youTrackMap := make(map[string]YouTrackIssue)
	for _, issue := range youTrackIssues {
		asanaID := extractAsanaID(issue)
		if asanaID != "" {
			youTrackMap[asanaID] = issue
		}
	}

	fmt.Println("\n📋 ASANA TASKS ANALYSIS:")
	fmt.Println(strings.Repeat("-", 60))

	newTasks := []AsanaTask{}
	updatableTasks := []struct {
		AsanaTask  AsanaTask
		YouTrackID string
	}{}

	for i, task := range asanaTasks {
		sectionName := "No Section"
		if len(task.Memberships) > 0 {
			sectionName = task.Memberships[0].Section.Name
		}

		fmt.Printf("%d. 📝 %s\n", i+1, task.Name)
		fmt.Printf("   📂 Section: %s\n", sectionName)
		if task.Notes != "" {
			fmt.Printf("   📄 Notes: %s\n", truncateString(task.Notes, 50))
		}

		if existingIssue, exists := youTrackMap[task.GID]; exists {
			fmt.Printf("   ✅ EXISTS in YouTrack (ID: %s)\n", existingIssue.ID)
			updatableTasks = append(updatableTasks, struct {
				AsanaTask  AsanaTask
				YouTrackID string
			}{task, existingIssue.ID})
		} else {
			fmt.Printf("   ➕ NEW - Not in YouTrack yet\n")
			newTasks = append(newTasks, task)
		}
		fmt.Println()
	}

	// Process new tasks
	if len(newTasks) > 0 {
		fmt.Printf("\n🆕 NEW TASKS TO CREATE (%d):\n", len(newTasks))
		fmt.Println(strings.Repeat("-", 40))

		for i, task := range newTasks {
			sectionName := "No Section"
			if len(task.Memberships) > 0 {
				sectionName = task.Memberships[0].Section.Name
			}

			fmt.Printf("%d. %s (Section: %s)\n", i+1, task.Name, sectionName)
		}

		if askForBulkApproval("Create these new tickets in YouTrack") {
			for _, task := range newTasks {
				fmt.Printf("➕ Creating '%s'...", task.Name)
				err := createYouTrackIssue(task)
				if err != nil {
					fmt.Printf(" ❌ Failed: %v\n", err)
				} else {
					fmt.Printf(" ✅ Success!\n")
				}
			}
		}
	}

	// Process updates
	if len(updatableTasks) > 0 {
		fmt.Printf("\n🔄 EXISTING TASKS TO UPDATE (%d):\n", len(updatableTasks))
		fmt.Println(strings.Repeat("-", 40))

		for i, item := range updatableTasks {
			sectionName := "No Section"
			if len(item.AsanaTask.Memberships) > 0 {
				sectionName = item.AsanaTask.Memberships[0].Section.Name
			}

			fmt.Printf("%d. %s (Section: %s)\n", i+1, item.AsanaTask.Name, sectionName)
		}

		if askForBulkApproval("Update these existing tickets in YouTrack") {
			for _, item := range updatableTasks {
				fmt.Printf("🔄 Updating '%s'...", item.AsanaTask.Name)
				err := updateYouTrackIssue(item.YouTrackID, item.AsanaTask)
				if err != nil {
					fmt.Printf(" ❌ Failed: %v\n", err)
				} else {
					fmt.Printf(" ✅ Success!\n")
				}
			}
		}
	}

	if len(newTasks) == 0 && len(updatableTasks) == 0 {
		fmt.Println("✨ All Asana tasks are already synced with YouTrack!")
	}
}

func detectChanges() ([]SyncAction, error) {
	var actions []SyncAction

	// Get Asana tasks
	asanaTasks, err := getAsanaTasks()
	if err != nil {
		return nil, fmt.Errorf("failed to get Asana tasks: %v", err)
	}

	// Get YouTrack issues
	youTrackIssues, err := getYouTrackIssues()
	if err != nil {
		return nil, fmt.Errorf("failed to get YouTrack issues: %v", err)
	}

	// Create maps for easier lookup
	youTrackMap := make(map[string]YouTrackIssue)
	for _, issue := range youTrackIssues {
		// Look for Asana ID in custom fields or description
		asanaID := extractAsanaID(issue)
		if asanaID != "" {
			youTrackMap[asanaID] = issue
		}
	}

	// Check for new or modified Asana tasks
	for _, task := range asanaTasks {
		modifiedAt, _ := time.Parse(time.RFC3339, task.ModifiedAt)

		if existingIssue, exists := youTrackMap[task.GID]; exists {
			// Task exists, check if it needs updating
			if modifiedAt.After(lastSyncTime) {
				actions = append(actions, SyncAction{
					Type:        "UPDATE",
					AsanaTask:   task,
					YouTrackID:  existingIssue.ID,
					Description: fmt.Sprintf("Update '%s' in YouTrack", task.Name),
				})
			}
		} else {
			// New task, needs to be created
			createdAt, _ := time.Parse(time.RFC3339, task.CreatedAt)
			if createdAt.After(lastSyncTime) {
				actions = append(actions, SyncAction{
					Type:        "CREATE",
					AsanaTask:   task,
					Description: fmt.Sprintf("Create new ticket '%s' in YouTrack", task.Name),
				})
			}
		}
	}

	return actions, nil
}

func processActions(actions []SyncAction) {
	for i, action := range actions {
		fmt.Printf("\n📋 Action %d/%d: %s\n", i+1, len(actions), action.Description)
		fmt.Printf("   Task: %s\n", action.AsanaTask.Name)
		if action.AsanaTask.Notes != "" {
			fmt.Printf("   Notes: %s\n", truncateString(action.AsanaTask.Notes, 100))
		}

		// Get user approval
		if !askForBulkApproval("Proceed with this action") {
			fmt.Println("❌ Skipped")
			continue
		}

		// Execute the action
		switch action.Type {
		case "CREATE":
			err := createYouTrackIssue(action.AsanaTask)
			if err != nil {
				fmt.Printf("❌ Failed to create: %v\n", err)
			} else {
				fmt.Println("✅ Created successfully")
			}
		case "UPDATE":
			err := updateYouTrackIssue(action.YouTrackID, action.AsanaTask)
			if err != nil {
				fmt.Printf("❌ Failed to update: %v\n", err)
			} else {
				fmt.Println("✅ Updated successfully")
			}
		}
	}

	lastSyncTime = time.Now()
}

func askForBulkApproval(action string) bool {
	fmt.Printf("\n❓ %s? (y/N): ", action)
	reader := bufio.NewReader(os.Stdin)
	response, _ := reader.ReadString('\n')
	response = strings.TrimSpace(strings.ToLower(response))
	return response == "y" || response == "yes"
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
	// Get issues from the correct project using shortName
	url := fmt.Sprintf("%s/api/issues?fields=id,summary,description,created,updated,customFields(name,value)&query=project: %s&top=200",
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
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("YouTrack API error: %d - %s", resp.StatusCode, string(body))
	}

	var issues []YouTrackIssue
	if err := json.NewDecoder(resp.Body).Decode(&issues); err != nil {
		return nil, err
	}

	return issues, nil
}

func findYouTrackProject() (string, error) {
	// First test basic connection
	fmt.Println("🔗 Testing YouTrack connection...")

	url := fmt.Sprintf("%s/api/admin/projects?fields=id,name,shortName&top=10", config.YouTrackBaseURL)

	fmt.Printf("🌐 Connecting to: %s\n", config.YouTrackBaseURL)

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
		fmt.Printf("❌ Response body: %s\n", string(body))
		return "", fmt.Errorf("YouTrack API error: %d", resp.StatusCode)
	}

	var projects []struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		ShortName string `json:"shortName"`
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&projects); err != nil {
		fmt.Printf("❌ JSON decode error: %v\n", err)
		fmt.Printf("❌ Response body: %s\n", string(body))
		return "", err
	}

	fmt.Printf("✅ Found %d projects\n", len(projects))

	// Look for project by ID or shortName
	for _, proj := range projects {
		if proj.ID == config.YouTrackProjectID || proj.ShortName == config.YouTrackProjectID {
			fmt.Printf("✅ Found matching project: %s (%s)\n", proj.Name, proj.ShortName)
			return proj.ShortName, nil
		}
	}

	return "", fmt.Errorf("project not found")
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

		// Try alternative endpoint
		fmt.Println("🔄 Trying alternative projects endpoint...")
		url2 := fmt.Sprintf("%s/api/projects?fields=id,name,shortName", config.YouTrackBaseURL)
		req2, _ := http.NewRequest("GET", url2, nil)
		req2.Header.Set("Authorization", "Bearer "+config.YouTrackToken)
		req2.Header.Set("Accept", "application/json")

		resp2, err2 := client.Do(req2)
		if err2 != nil {
			fmt.Printf("❌ Alternative endpoint also failed: %v\n", err2)
			return
		}
		defer resp2.Body.Close()

		body2, _ := io.ReadAll(resp2.Body)
		fmt.Printf("📡 Alternative endpoint status: %d\n", resp2.StatusCode)
		if resp2.StatusCode != http.StatusOK {
			fmt.Printf("❌ Alternative response: %s\n", string(body2))
			return
		}
		body = body2
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
	// Determine state based on Asana section
	state := mapAsanaStateToYouTrack(task)

	// Create issue with proper YouTrack structure
	payload := map[string]interface{}{
		"$type":       "Issue",
		"summary":     task.Name,
		"description": fmt.Sprintf("%s\n\n[Synced from Asana ID: %s]", task.Notes, task.GID),
		"project": map[string]interface{}{
			"$type":     "Project",
			"shortName": config.YouTrackProjectID,
		},
	}

	// Add state if available
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

	fmt.Printf("🔧 Debug: Creating issue in project: %s\n", config.YouTrackProjectID)
	fmt.Printf("🔧 Debug: Payload: %s\n", string(jsonPayload))

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

	fmt.Printf("✅ Success! Response: %s\n", string(body))
	return nil
}

func updateYouTrackIssue(issueID string, task AsanaTask) error {
	// Determine state based on Asana section
	state := mapAsanaStateToYouTrack(task)

	payload := map[string]interface{}{
		"summary":     task.Name,
		"description": fmt.Sprintf("%s\n\n[Synced from Asana ID: %s]", task.Notes, task.GID),
	}

	// Add state if available
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
		return "To Do" // Default state
	}

	sectionName := strings.ToLower(task.Memberships[0].Section.Name)

	switch {
	case strings.Contains(sectionName, "backlog"):
		return "To Do"
	case strings.Contains(sectionName, "progress") || strings.Contains(sectionName, "doing"):
		return "In Progress"
	case strings.Contains(sectionName, "dev") || strings.Contains(sectionName, "development"):
		return "In Progress"
	case strings.Contains(sectionName, "done") || strings.Contains(sectionName, "complete"):
		return "Done"
	default:
		return "To Do"
	}
}

func extractAsanaID(issue YouTrackIssue) string {
	// Look for Asana ID in description
	if strings.Contains(issue.Description, "Asana ID:") {
		lines := strings.Split(issue.Description, "\n")
		for _, line := range lines {
			if strings.Contains(line, "Asana ID:") {
				parts := strings.Split(line, "Asana ID:")
				if len(parts) > 1 {
					return strings.TrimSpace(parts[1])
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
	json.NewEncoder(w).Encode(map[string]string{
		"status":    "healthy",
		"service":   "asana-youtrack-sync",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func statusCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service":          "asana-youtrack-sync",
		"last_sync":        lastSyncTime.Format(time.RFC3339),
		"poll_interval":    config.PollIntervalMS,
		"asana_project":    config.AsanaProjectID,
		"youtrack_project": config.YouTrackProjectID,
	})
}
