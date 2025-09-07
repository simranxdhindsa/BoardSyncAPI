package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// ENHANCED: Asana API Functions with Tag Support
func getAsanaTasks() ([]AsanaTask, error) {
	// FIXED: Added tags to opt_fields to fetch Asana tags
	url := fmt.Sprintf("https://app.asana.com/api/1.0/projects/%s/tasks?opt_fields=gid,name,notes,completed_at,created_at,modified_at,memberships.section.gid,memberships.section.name,tags.gid,tags.name", config.AsanaProjectID)

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

// ENHANCED: YouTrack API Functions with Subsystem Support
func getYouTrackIssues() ([]YouTrackIssue, error) {
	fmt.Printf("Connecting to YouTrack Cloud: %s\n", config.YouTrackBaseURL)
	fmt.Printf("Looking for project: %s\n", config.YouTrackProjectID)

	approaches := []func() ([]YouTrackIssue, error){
		getYouTrackIssuesWithQuery,
		getYouTrackIssuesSimpleCloud,
		getYouTrackIssuesViaProjects,
	}

	for i, approach := range approaches {
		fmt.Printf("Attempting approach %d...\n", i+1)
		issues, err := approach()
		if err == nil && len(issues) >= 0 {
			fmt.Printf("Approach %d succeeded! Found %d issues\n", i+1, len(issues))
			return issues, nil
		}
		fmt.Printf("Approach %d failed: %v\n", i+1, err)
	}

	return nil, fmt.Errorf("all approaches failed to connect to YouTrack Cloud")
}

func getYouTrackIssuesWithQuery() ([]YouTrackIssue, error) {
	queries := []string{
		fmt.Sprintf("project:%s", config.YouTrackProjectID),
		fmt.Sprintf("project: %s", config.YouTrackProjectID),
		fmt.Sprintf("#%s", config.YouTrackProjectID),
	}

	// FIXED: Comprehensive fields parameter to fetch all subsystem data
	fields := "id,summary,description,created,updated,customFields(name,value(name,localizedName,description,id,$type,color)),project(shortName)"

	for i, query := range queries {
		fmt.Printf("   Query format %d: %s\n", i+1, query)

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
			fmt.Printf("   Network error: %v\n", err)
			continue
		}

		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		fmt.Printf("   Status: %d\n", resp.StatusCode)

		if resp.StatusCode == http.StatusOK {
			var issues []YouTrackIssue
			if err := json.Unmarshal(body, &issues); err != nil {
				fmt.Printf("   JSON error: %v\n", err)
				continue
			}
			return issues, nil
		}
	}

	return nil, fmt.Errorf("query approach failed")
}

func getYouTrackIssuesSimpleCloud() ([]YouTrackIssue, error) {
	fmt.Println("   Trying simple issues endpoint...")

	// FIXED: Enhanced fields parameter to properly fetch subsystem data
	url := fmt.Sprintf("%s/api/issues?fields=id,summary,description,created,updated,customFields(name,value(name,localizedName,description,id,$type)),project(shortName)&top=200",
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
	fmt.Printf("   Status: %d\n", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		bodyStr := string(body)
		if len(bodyStr) > 300 {
			bodyStr = bodyStr[:300] + "..."
		}
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, bodyStr)
	}

	var allIssues []YouTrackIssue

	if err := json.Unmarshal(body, &allIssues); err != nil {
		return nil, fmt.Errorf("JSON parsing error: %v", err)
	}

	var projectIssues []YouTrackIssue
	fmt.Printf("   Filtering %d total issues for project '%s'\n", len(allIssues), config.YouTrackProjectID)

	for _, issue := range allIssues {
		if issue.Project.ShortName == config.YouTrackProjectID {
			projectIssues = append(projectIssues, issue)
		}
	}

	return projectIssues, nil
}

func getYouTrackIssuesViaProjects() ([]YouTrackIssue, error) {
	fmt.Println("   Trying project-specific endpoint...")

	// FIXED: Enhanced fields for better data retrieval
	url := fmt.Sprintf("%s/api/admin/projects/%s/issues?fields=id,summary,description,created,updated,customFields(name,value(name,localizedName)),project(shortName)&top=200",
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
	fmt.Printf("   Status: %d\n", resp.StatusCode)

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
	fmt.Println("Testing YouTrack Cloud connection...")
	fmt.Printf("URL: %s\n", config.YouTrackBaseURL)
	fmt.Printf("Project: %s\n", config.YouTrackProjectID)

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

	fmt.Printf("Response status: %d\n", resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		fmt.Println("Trying alternative projects endpoint...")
		return findYouTrackProjectAlternative()
	}

	var projects []struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		ShortName string `json:"shortName"`
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&projects); err != nil {
		fmt.Printf("JSON decode error: %v\n", err)
		return "", err
	}

	fmt.Printf("Found %d projects\n", len(projects))

	for _, proj := range projects {
		if proj.ID == config.YouTrackProjectID || proj.ShortName == config.YouTrackProjectID {
			fmt.Printf("Found matching project: %s (%s)\n", proj.Name, proj.ShortName)
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
	fmt.Printf("Alternative endpoint status: %d\n", resp.StatusCode)

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

	fmt.Printf("Alternative endpoint found %d projects\n", len(projects))

	for _, proj := range projects {
		if proj.ID == config.YouTrackProjectID || proj.ShortName == config.YouTrackProjectID {
			fmt.Printf("Found project: %s (%s)\n", proj.Name, proj.ShortName)
			return proj.ShortName, nil
		}
	}

	return "", fmt.Errorf("project '%s' not found in %d available projects", config.YouTrackProjectID, len(projects))
}

func listYouTrackProjects() {
	fmt.Println("Let me list all available projects...")

	url := fmt.Sprintf("%s/api/admin/projects?fields=id,name,shortName&top=20", config.YouTrackBaseURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Printf("Error creating request: %v\n", err)
		return
	}

	req.Header.Set("Authorization", "Bearer "+config.YouTrackToken)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Cache-Control", "no-cache")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error connecting to YouTrack: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("Projects API Response Status: %d\n", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Raw response: %s\n", string(body))
		return
	}

	var projects []struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		ShortName string `json:"shortName"`
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&projects); err != nil {
		fmt.Printf("Error parsing JSON: %v\n", err)
		fmt.Printf("Response was: %s\n", string(body))
		return
	}

	if len(projects) == 0 {
		fmt.Println("No projects found - check your token permissions")
		return
	}

	fmt.Printf("Found %d projects:\n\n", len(projects))
	for i, proj := range projects {
		fmt.Printf("   %d. Name: %s\n", i+1, proj.Name)
		fmt.Printf("      Key: %s (use this in .env)\n", proj.ShortName)
		fmt.Printf("      ID: %s\n\n", proj.ID)
	}

	fmt.Println("Copy one of the 'Key' values above and update your .env file:")
	fmt.Printf("   YOUTRACK_PROJECT_ID=<paste_key_here>\n")
}

// ENHANCED: Create YouTrack Issue with Tag/Subsystem Support
func createYouTrackIssue(task AsanaTask) error {
	// Check for duplicate tickets first
	if isDuplicateTicket(task.Name) {
		return fmt.Errorf("ticket with title '%s' already exists in YouTrack", task.Name)
	}

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

	// Build custom fields array
	customFields := []map[string]interface{}{}

	// Add State field
	if state != "" {
		customFields = append(customFields, map[string]interface{}{
			"$type": "StateIssueCustomField",
			"name":  "State",
			"value": map[string]interface{}{
				"$type": "StateBundleElement",
				"name":  state,
			},
		})
	}

	// NEW: Add Subsystem based on Asana tags (with proper $type annotations)
	asanaTags := getAsanaTags(task)
	if len(asanaTags) > 0 {
		primaryTag := asanaTags[0] // Use first tag
		subsystem := mapTagToSubsystem(primaryTag)
		if subsystem != "" {
			// Use proper multi-value field structure with $type annotations
			customFields = append(customFields, map[string]interface{}{
				"$type": "MultiOwnedIssueCustomField",
				"name":  "Subsystem",
				"value": []map[string]interface{}{
					{
						"$type": "OwnedBundleElement",
						"name":  subsystem,
					},
				},
			})
		}
	}

	if len(customFields) > 0 {
		payload["customFields"] = customFields
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

// NEW: Create Single YouTrack Issue by Task ID
func createSingleYouTrackIssue(taskID string) error {
	// Get all Asana tasks
	allTasks, err := getAsanaTasks()
	if err != nil {
		return fmt.Errorf("failed to get Asana tasks: %v", err)
	}

	// Find the specific task
	var targetTask *AsanaTask
	for _, task := range allTasks {
		if task.GID == taskID {
			targetTask = &task
			break
		}
	}

	if targetTask == nil {
		return fmt.Errorf("task with ID '%s' not found in Asana", taskID)
	}

	// Create the issue
	return createYouTrackIssue(*targetTask)
}

// ENHANCED: Update YouTrack Issue with Tag/Subsystem Support (with error handling)
func updateYouTrackIssue(issueID string, task AsanaTask) error {
	state := mapAsanaStateToYouTrack(task)

	if state == "FINDINGS_NO_SYNC" || state == "READY_FOR_STAGE_NO_SYNC" {
		return fmt.Errorf("cannot update ticket for display-only column")
	}

	// First, try updating without subsystem to ensure status sync works
	payload := map[string]interface{}{
		"$type":       "Issue",
		"summary":     task.Name,
		"description": fmt.Sprintf("%s\n\n[Synced from Asana ID: %s]", task.Notes, task.GID),
	}

	// Build custom fields array
	customFields := []map[string]interface{}{}

	// Add State field
	if state != "" {
		customFields = append(customFields, map[string]interface{}{
			"$type": "StateIssueCustomField",
			"name":  "State",
			"value": map[string]interface{}{
				"$type": "StateBundleElement",
				"name":  state,
			},
		})
	}

	// Try to add Subsystem (with proper $type annotations for multi-value field)
	asanaTags := getAsanaTags(task)
	subsystemUpdateFailed := false
	if len(asanaTags) > 0 {
		primaryTag := asanaTags[0]
		subsystem := mapTagToSubsystem(primaryTag)
		if subsystem != "" {
			customFields = append(customFields, map[string]interface{}{
				"$type": "MultiOwnedIssueCustomField",
				"name":  "Subsystem",
				"value": []map[string]interface{}{
					{
						"$type": "OwnedBundleElement",
						"name":  subsystem,
					},
				},
			})
		}
	}

	if len(customFields) > 0 {
		payload["customFields"] = customFields
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

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		// Check if error is specifically about Subsystem field
		bodyStr := string(body)
		if strings.Contains(bodyStr, "incompatible-issue-custom-field-name-Subsystem") {
			subsystemUpdateFailed = true
			// Retry without Subsystem field
			return updateYouTrackIssueWithoutSubsystem(issueID, task)
		}
		return fmt.Errorf("YouTrack update error: %d - %s", resp.StatusCode, bodyStr)
	}

	// Log successful update with subsystem info
	if len(asanaTags) > 0 && !subsystemUpdateFailed {
		fmt.Printf("Successfully updated ticket %s with tags: %v\n", issueID, asanaTags)
	}

	return nil
}

// Fallback function to update without subsystem field
func updateYouTrackIssueWithoutSubsystem(issueID string, task AsanaTask) error {
	state := mapAsanaStateToYouTrack(task)

	payload := map[string]interface{}{
		"$type":       "Issue",
		"summary":     task.Name,
		"description": fmt.Sprintf("%s\n\n[Synced from Asana ID: %s]", task.Notes, task.GID),
	}

	// Only add State field, skip Subsystem
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

	asanaTags := getAsanaTags(task)
	if len(asanaTags) > 0 {
		fmt.Printf("Updated ticket %s (status only - Subsystem field not available). Tags: %v\n", issueID, asanaTags)
	}

	return nil
}

func isDuplicateTicket(title string) bool {
	// Search for existing tickets with same title
	query := fmt.Sprintf("project:%s summary:%s", config.YouTrackProjectID, title)
	encodedQuery := strings.ReplaceAll(query, " ", "%20")

	url := fmt.Sprintf("%s/api/issues?fields=id,summary&query=%s&top=5",
		config.YouTrackBaseURL, encodedQuery)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return false
	}

	req.Header.Set("Authorization", "Bearer "+config.YouTrackToken)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false
	}

	var issues []YouTrackIssue
	if err := json.NewDecoder(resp.Body).Decode(&issues); err != nil {
		return false
	}

	// Check for exact title match
	for _, issue := range issues {
		if strings.EqualFold(issue.Summary, title) {
			return true
		}
	}

	return false
}

// SIMPLIFIED: Analysis Functions - Status-Only Sync (Tags are Write-Only)
func performTicketAnalysis(selectedColumns []string) (*TicketAnalysis, error) {
	allAsanaTasks, err := getAsanaTasks()
	if err != nil {
		return nil, fmt.Errorf("failed to get Asana tasks: %v", err)
	}

	// Filter tasks by selected columns
	asanaTasks := filterAsanaTasksByColumns(allAsanaTasks, selectedColumns)

	youTrackIssues, err := getYouTrackIssues()
	if err != nil {
		return nil, fmt.Errorf("failed to get YouTrack issues: %v", err)
	}

	youTrackMap := make(map[string]YouTrackIssue)
	asanaMap := make(map[string]AsanaTask)

	// Build YouTrack mapping
	for _, issue := range youTrackIssues {
		asanaID := extractAsanaID(issue)
		if asanaID != "" {
			youTrackMap[asanaID] = issue
		}
	}

	// Build Asana mapping
	for _, task := range asanaTasks {
		asanaMap[task.GID] = task
	}

	analysis := &TicketAnalysis{
		SelectedColumn:   strings.Join(selectedColumns, ", "),
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

	// SIMPLIFIED: Process Asana tasks - ONLY compare STATUS, ignore tags for sync decisions
	for _, task := range asanaTasks {
		if isIgnored(task.GID) {
			continue
		}

		sectionName := getSectionName(task)
		asanaTags := getAsanaTags(task) // Still extract for display/writing purposes

		// Handle special display-only columns
		if strings.Contains(sectionName, "findings") {
			analysis.FindingsTickets = append(analysis.FindingsTickets, task)

			// Check for high alerts - if YouTrack ticket exists and is active
			if existingIssue, exists := youTrackMap[task.GID]; exists {
				youtrackStatus := getYouTrackStatus(existingIssue)
				if isActiveYouTrackStatus(youtrackStatus) {
					analysis.FindingsAlerts = append(analysis.FindingsAlerts, FindingsAlert{
						AsanaTask:      task,
						YouTrackIssue:  existingIssue,
						YouTrackStatus: youtrackStatus,
						AlertMessage:   fmt.Sprintf("HIGH ALERT: '%s' is in Findings (Asana) but still active in YouTrack (%s)", task.Name, youtrackStatus),
					})
				}
			}
			continue
		}

		if strings.Contains(sectionName, "ready for stage") {
			analysis.ReadyForStage = append(analysis.ReadyForStage, task)
			continue
		}

		// SIMPLIFIED: Handle syncable columns - ONLY compare status, not tags
		if existingIssue, exists := youTrackMap[task.GID]; exists {
			asanaStatus := mapAsanaStateToYouTrack(task)
			youtrackStatus := getYouTrackStatus(existingIssue)

			if strings.Contains(sectionName, "blocked") {
				analysis.BlockedTickets = append(analysis.BlockedTickets, MatchedTicket{
					AsanaTask:         task,
					YouTrackIssue:     existingIssue,
					Status:            asanaStatus,
					AsanaTags:         asanaTags, // Include for display only
					YouTrackSubsystem: "",        // Don't read from YouTrack
					TagMismatch:       false,     // Never consider tag mismatch
				})
			} else if asanaStatus == youtrackStatus {
				// MATCHED: Status is the same
				analysis.Matched = append(analysis.Matched, MatchedTicket{
					AsanaTask:         task,
					YouTrackIssue:     existingIssue,
					Status:            asanaStatus,
					AsanaTags:         asanaTags, // Include for display only
					YouTrackSubsystem: "",        // Don't read from YouTrack
					TagMismatch:       false,     // Never consider tag mismatch
				})
			} else {
				// MISMATCHED: Status is different
				analysis.Mismatched = append(analysis.Mismatched, MismatchedTicket{
					AsanaTask:         task,
					YouTrackIssue:     existingIssue,
					AsanaStatus:       asanaStatus,
					YouTrackStatus:    youtrackStatus,
					AsanaTags:         asanaTags, // Include for display only
					YouTrackSubsystem: "",        // Don't read from YouTrack
					TagMismatch:       false,     // Never consider tag mismatch
				})
			}
		} else {
			// Missing in YouTrack (only for syncable columns)
			if isSyncableColumn(sectionName) {
				analysis.MissingYouTrack = append(analysis.MissingYouTrack, task)
			}
		}
	}

	// Check for orphaned YouTrack tickets
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

// Interactive Functions
func handleInteractiveSync(mismatched []MismatchedTicket, reader *bufio.Reader) {
	if len(mismatched) == 0 {
		fmt.Println("No mismatched tickets to sync.")
		return
	}

	fmt.Printf("\nMismatched tickets available for sync:\n")
	fmt.Println(strings.Repeat("-", 80))

	// Display all mismatched tickets with numbers (simplified - status only)
	for i, ticket := range mismatched {
		fmt.Printf("%d. \"%s\"\n", i+1, ticket.AsanaTask.Name)
		fmt.Printf("   Status: Asana (%s) -> YouTrack (%s)\n", ticket.AsanaStatus, ticket.YouTrackStatus)
		// SIMPLIFIED: Show tags for display only, don't mention subsystem sync issues
		if len(ticket.AsanaTags) > 0 {
			fmt.Printf("   Tags: %s (will be synced to subsystem)\n", strings.Join(ticket.AsanaTags, ", "))
		}
		fmt.Printf("   YouTrack ID: %s\n", ticket.YouTrackIssue.ID)
		fmt.Println()
	}

	for {
		fmt.Println("Sync Options:")
		fmt.Println("  [a] Sync all tickets")
		fmt.Println("  [s] Select specific tickets to sync")
		fmt.Println("  [l] List tickets again")
		fmt.Println("  [q] Cancel sync")

		fmt.Print("Your choice (a/s/l/q): ")
		input, _ := reader.ReadString('\n')
		choice := strings.TrimSpace(strings.ToLower(input))

		switch choice {
		case "a":
			syncTickets := mismatched
			performBatchSync(syncTickets, reader)
			return

		case "s":
			selectedTickets := selectTicketsInteractive(mismatched, reader, "sync")
			if len(selectedTickets) > 0 {
				performBatchSync(selectedTickets, reader)
			}
			return

		case "l":
			// Re-display the list
			fmt.Printf("\nMismatched tickets:\n")
			fmt.Println(strings.Repeat("-", 80))
			for i, ticket := range mismatched {
				fmt.Printf("%d. \"%s\" - Asana (%s) -> YouTrack (%s)\n",
					i+1, ticket.AsanaTask.Name, ticket.AsanaStatus, ticket.YouTrackStatus)
			}
			fmt.Println()
			continue

		case "q":
			fmt.Println("Sync cancelled.")
			return

		default:
			fmt.Println("Invalid choice. Please enter a, s, l, or q.")
			continue
		}
	}
}

func handleCreateMissingTickets(missing []AsanaTask) {
	if len(missing) == 0 {
		fmt.Println("No missing tickets to create.")
		return
	}

	reader := bufio.NewReader(os.Stdin)

	fmt.Printf("\nMissing tickets available for creation:\n")
	fmt.Println(strings.Repeat("-", 80))

	// Display all missing tickets with numbers
	for i, task := range missing {
		fmt.Printf("%d. \"%s\"\n", i+1, task.Name)
		sectionName := getSectionName(task)
		fmt.Printf("   Section: %s\n", sectionName)
		asanaTags := getAsanaTags(task)
		if len(asanaTags) > 0 {
			fmt.Printf("   Tags: %s\n", strings.Join(asanaTags, ", "))
		}
		fmt.Printf("   Asana ID: %s\n", task.GID)
		fmt.Println()
	}

	for {
		fmt.Println("Creation Options:")
		fmt.Println("  [a] Create all tickets")
		fmt.Println("  [s] Select specific tickets to create")
		fmt.Println("  [l] List tickets again")
		fmt.Println("  [q] Cancel creation")

		fmt.Print("Your choice (a/s/l/q): ")
		input, _ := reader.ReadString('\n')
		choice := strings.TrimSpace(strings.ToLower(input))

		switch choice {
		case "a":
			performBatchCreate(missing)
			return

		case "s":
			selectedTasks := selectTasksInteractive(missing, reader)
			if len(selectedTasks) > 0 {
				performBatchCreate(selectedTasks)
			}
			return

		case "l":
			// Re-display the list
			fmt.Printf("\nMissing tickets:\n")
			fmt.Println(strings.Repeat("-", 80))
			for i, task := range missing {
				fmt.Printf("%d. \"%s\" - Section: %s\n",
					i+1, task.Name, getSectionName(task))
			}
			fmt.Println()
			continue

		case "q":
			fmt.Println("Creation cancelled.")
			return

		default:
			fmt.Println("Invalid choice. Please enter a, s, l, or q.")
			continue
		}
	}
}

// NEW: Interactive ticket selection for sync
func selectTicketsInteractive(tickets []MismatchedTicket, reader *bufio.Reader, operation string) []MismatchedTicket {
	fmt.Printf("\nSelect tickets to %s (comma-separated numbers, or ranges like 1-3):\n", operation)
	fmt.Printf("Example: 1,3,5-7 or just 2\n")
	fmt.Print("Selection: ")

	input, _ := reader.ReadString('\n')
	selection := strings.TrimSpace(input)

	if selection == "" {
		fmt.Println("No selection made.")
		return []MismatchedTicket{}
	}

	indices := parseSelection(selection, len(tickets))
	if len(indices) == 0 {
		fmt.Println("Invalid selection.")
		return []MismatchedTicket{}
	}

	var selectedTickets []MismatchedTicket
	fmt.Println("\nSelected tickets:")
	for _, idx := range indices {
		if idx >= 0 && idx < len(tickets) {
			selectedTickets = append(selectedTickets, tickets[idx])
			fmt.Printf("- %s\n", tickets[idx].AsanaTask.Name)
		}
	}

	return selectedTickets
}

// NEW: Interactive task selection for creation
func selectTasksInteractive(tasks []AsanaTask, reader *bufio.Reader) []AsanaTask {
	fmt.Println("\nSelect tasks to create (comma-separated numbers, or ranges like 1-3):")
	fmt.Printf("Example: 1,3,5-7 or just 2\n")
	fmt.Print("Selection: ")

	input, _ := reader.ReadString('\n')
	selection := strings.TrimSpace(input)

	if selection == "" {
		fmt.Println("No selection made.")
		return []AsanaTask{}
	}

	indices := parseSelection(selection, len(tasks))
	if len(indices) == 0 {
		fmt.Println("Invalid selection.")
		return []AsanaTask{}
	}

	var selectedTasks []AsanaTask
	fmt.Println("\nSelected tasks:")
	for _, idx := range indices {
		if idx >= 0 && idx < len(tasks) {
			selectedTasks = append(selectedTasks, tasks[idx])
			fmt.Printf("- %s\n", tasks[idx].Name)
		}
	}

	return selectedTasks
}

// NEW: Parse user selection (supports ranges and comma-separated values)
func parseSelection(input string, maxCount int) []int {
	var indices []int
	parts := strings.Split(input, ",")

	for _, part := range parts {
		part = strings.TrimSpace(part)

		if strings.Contains(part, "-") {
			// Handle range like "1-3"
			rangeParts := strings.Split(part, "-")
			if len(rangeParts) == 2 {
				start, err1 := strconv.Atoi(strings.TrimSpace(rangeParts[0]))
				end, err2 := strconv.Atoi(strings.TrimSpace(rangeParts[1]))

				if err1 == nil && err2 == nil && start >= 1 && end <= maxCount && start <= end {
					for i := start; i <= end; i++ {
						indices = append(indices, i-1) // Convert to 0-based
					}
				}
			}
		} else {
			// Handle single number
			if num, err := strconv.Atoi(part); err == nil && num >= 1 && num <= maxCount {
				indices = append(indices, num-1) // Convert to 0-based
			}
		}
	}

	// Remove duplicates
	seen := make(map[int]bool)
	var uniqueIndices []int
	for _, idx := range indices {
		if !seen[idx] {
			seen[idx] = true
			uniqueIndices = append(uniqueIndices, idx)
		}
	}

	return uniqueIndices
}

// NEW: Perform batch sync with confirmation
func performBatchSync(tickets []MismatchedTicket, reader *bufio.Reader) {
	fmt.Printf("\nAbout to sync %d tickets. Continue? (y/n): ", len(tickets))
	input, _ := reader.ReadString('\n')
	if strings.TrimSpace(strings.ToLower(input)) != "y" {
		fmt.Println("Sync cancelled.")
		return
	}

	fmt.Printf("Syncing %d tickets...\n", len(tickets))
	fmt.Println(strings.Repeat("-", 60))

	synced := 0
	failed := 0

	for i, ticket := range tickets {
		fmt.Printf("%d/%d: Syncing \"%s\"...", i+1, len(tickets), ticket.AsanaTask.Name)

		err := updateYouTrackIssue(ticket.YouTrackIssue.ID, ticket.AsanaTask)
		if err != nil {
			fmt.Printf(" FAILED: %v\n", err)
			failed++
		} else {
			fmt.Printf(" SUCCESS")
			asanaTags := getAsanaTags(ticket.AsanaTask)
			if len(asanaTags) > 0 {
				fmt.Printf(" [Tags: %s]", strings.Join(asanaTags, ", "))
			}
			fmt.Printf(" (%s -> %s)\n", ticket.YouTrackStatus, ticket.AsanaStatus)
			synced++
		}
	}

	fmt.Printf("\nSync Summary:\n")
	fmt.Printf("  Synced: %d\n", synced)
	fmt.Printf("  Failed: %d\n", failed)
	fmt.Printf("  Total: %d\n", len(tickets))
}

// NEW: Perform batch creation with enhanced feedback
func performBatchCreate(tasks []AsanaTask) {
	fmt.Printf("Creating %d tickets in YouTrack...\n", len(tasks))
	fmt.Println(strings.Repeat("-", 60))

	created := 0
	skipped := 0
	failed := 0

	for i, task := range tasks {
		fmt.Printf("%d/%d: Creating \"%s\"...", i+1, len(tasks), task.Name)

		// Show tags if any
		asanaTags := getAsanaTags(task)
		if len(asanaTags) > 0 {
			fmt.Printf(" [Tags: %s]", strings.Join(asanaTags, ", "))
		}

		// Check for duplicates
		if isDuplicateTicket(task.Name) {
			fmt.Printf(" SKIPPED (duplicate exists)\n")
			skipped++
			continue
		}

		err := createYouTrackIssue(task)
		if err != nil {
			fmt.Printf(" FAILED: %v\n", err)
			failed++
		} else {
			fmt.Printf(" CREATED")
			if len(asanaTags) > 0 {
				primaryTag := asanaTags[0]
				mappedSubsystem := mapTagToSubsystem(primaryTag)
				fmt.Printf(" [Subsystem: %s]", mappedSubsystem)
			}
			fmt.Printf("\n")
			created++
		}
	}

	fmt.Printf("\nCreation Summary:\n")
	fmt.Printf("  Created: %d\n", created)
	fmt.Printf("  Skipped: %d (duplicates)\n", skipped)
	fmt.Printf("  Failed: %d\n", failed)
	fmt.Printf("  Total: %d\n", len(tasks))
}

// NEW: Tag/Subsystem Helper Functions
func getAsanaTags(task AsanaTask) []string {
	var tags []string
	for _, tag := range task.Tags {
		if tag.Name != "" {
			tags = append(tags, tag.Name)
		}
	}
	return tags
}

func getYouTrackSubsystem(issue YouTrackIssue) string {
	for _, field := range issue.CustomFields {
		if field.Name == "Subsystem" {
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
			}
		}
	}
	return ""
}

func mapTagToSubsystem(asanaTag string) string {
	// Check custom mapping first
	if subsystem, exists := defaultTagMapping[asanaTag]; exists {
		return subsystem
	}

	// Fallback to lowercase version
	asanaTagLower := strings.ToLower(asanaTag)
	if subsystem, exists := defaultTagMapping[asanaTagLower]; exists {
		return subsystem
	}

	// Default fallback: return lowercase tag
	return asanaTagLower
}

func checkTagMismatch(asanaTags []string, youtrackSubsystem string) bool {
	if len(asanaTags) == 0 && youtrackSubsystem == "" {
		return false // Both empty - no mismatch
	}

	if len(asanaTags) == 0 || youtrackSubsystem == "" {
		return true // One has data, other doesn't - mismatch
	}

	// Check if any Asana tag maps to the YouTrack subsystem
	for _, tag := range asanaTags {
		mappedSubsystem := mapTagToSubsystem(tag)
		fmt.Printf("DEBUG - Comparing tag '%s' -> mapped '%s' with YouTrack '%s'\n", tag, mappedSubsystem, youtrackSubsystem)

		// Case-insensitive comparison
		if strings.EqualFold(mappedSubsystem, youtrackSubsystem) {
			fmt.Printf("DEBUG - Found match: %s == %s\n", mappedSubsystem, youtrackSubsystem)
			return false // Found a match
		}
	}

	fmt.Printf("DEBUG - No match found for tags %v with subsystem '%s'\n", asanaTags, youtrackSubsystem)
	return true // No matches found
}

// Helper Functions
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
	case strings.Contains(sectionName, "dev") && !strings.Contains(sectionName, "ready"):
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

// FIXED: Improved YouTrack Status parsing
func getYouTrackStatus(issue YouTrackIssue) string {
	for _, field := range issue.CustomFields {
		if field.Name == "State" {
			switch value := field.Value.(type) {
			case map[string]interface{}:
				// Try localizedName first (more reliable)
				if name, ok := value["localizedName"].(string); ok && name != "" {
					return name
				}
				// Fallback to name
				if name, ok := value["name"].(string); ok && name != "" {
					return name
				}
			case string:
				if value != "" {
					return value
				}
			case nil:
				return "No State"
			}
		}
	}
	return "Unknown"
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

func getSectionName(task AsanaTask) string {
	if len(task.Memberships) == 0 {
		return "No Section"
	}
	return strings.ToLower(task.Memberships[0].Section.Name)
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

func isActiveYouTrackStatus(status string) bool {
	activeStatuses := []string{"Backlog", "In Progress", "DEV", "STAGE", "Blocked"}
	for _, activeStatus := range activeStatuses {
		if strings.EqualFold(status, activeStatus) {
			return true
		}
	}
	return false
}

func filterAsanaTasksByColumns(tasks []AsanaTask, selectedColumns []string) []AsanaTask {
	filtered := []AsanaTask{}
	for _, task := range tasks {
		if len(task.Memberships) > 0 {
			sectionName := strings.ToLower(task.Memberships[0].Section.Name)
			for _, selectedCol := range selectedColumns {
				if strings.Contains(sectionName, strings.ToLower(selectedCol)) {
					filtered = append(filtered, task)
					break
				}
			}
		}
	}
	return filtered
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

// Add this function to the end of your services.go file

// Stub function - Interactive mode disabled in favor of auto-sync
func runInteractiveMode() {
	// Interactive console disabled - use auto-sync API instead
	fmt.Println("Interactive mode disabled. Use the web dashboard and auto-sync functionality.")
	// Keep the function running to prevent main from exiting
	select {}
}
