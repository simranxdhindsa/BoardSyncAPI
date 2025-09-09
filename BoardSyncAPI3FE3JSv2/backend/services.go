package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// ENHANCED: Asana API Functions with Tag Support
func getAsanaTasks() ([]AsanaTask, error) {
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
		return nil, fmt.Errorf("asana API error: %d - %s", resp.StatusCode, string(body))
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

	customFields := []map[string]interface{}{}

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

	asanaTags := getAsanaTags(task)
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

// Rest of the functions would continue here...
// Let me split this into parts to avoid hitting length limits

func updateYouTrackIssue(issueID string, task AsanaTask) error {
	state := mapAsanaStateToYouTrack(task)

	if state == "FINDINGS_NO_SYNC" || state == "READY_FOR_STAGE_NO_SYNC" {
		return fmt.Errorf("cannot update ticket for display-only column")
	}

	payload := map[string]interface{}{
		"$type":       "Issue",
		"summary":     task.Name,
		"description": fmt.Sprintf("%s\n\n[Synced from Asana ID: %s]", task.Notes, task.GID),
	}

	customFields := []map[string]interface{}{}

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

	asanaTags := getAsanaTags(task)
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
		bodyStr := string(body)
		if strings.Contains(bodyStr, "incompatible-issue-custom-field-name-Subsystem") {
			return updateYouTrackIssueWithoutSubsystem(issueID, task)
		}
		return fmt.Errorf("YouTrack update error: %d - %s", resp.StatusCode, bodyStr)
	}

	if len(asanaTags) > 0 {
		fmt.Printf("Successfully updated ticket %s with tags: %v\n", issueID, asanaTags)
	}

	return nil
}

func updateYouTrackIssueWithoutSubsystem(issueID string, task AsanaTask) error {
	state := mapAsanaStateToYouTrack(task)

	payload := map[string]interface{}{
		"$type":       "Issue",
		"summary":     task.Name,
		"description": fmt.Sprintf("%s\n\n[Synced from Asana ID: %s]", task.Notes, task.GID),
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

	for _, issue := range issues {
		if strings.EqualFold(issue.Summary, title) {
			return true
		}
	}

	return false
}

// Analysis Functions
func performTicketAnalysis(selectedColumns []string) (*TicketAnalysis, error) {
	allAsanaTasks, err := getAsanaTasks()
	if err != nil {
		return nil, fmt.Errorf("failed to get Asana tasks: %v", err)
	}

	asanaTasks := filterAsanaTasksByColumns(allAsanaTasks, selectedColumns)

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

	for _, task := range asanaTasks {
		if isIgnored(task.GID) {
			continue
		}

		sectionName := getSectionName(task)
		asanaTags := getAsanaTags(task)

		if strings.Contains(sectionName, "findings") {
			analysis.FindingsTickets = append(analysis.FindingsTickets, task)

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

		if existingIssue, exists := youTrackMap[task.GID]; exists {
			asanaStatus := mapAsanaStateToYouTrack(task)
			youtrackStatus := getYouTrackStatus(existingIssue)

			if strings.Contains(sectionName, "blocked") {
				analysis.BlockedTickets = append(analysis.BlockedTickets, MatchedTicket{
					AsanaTask:         task,
					YouTrackIssue:     existingIssue,
					Status:            asanaStatus,
					AsanaTags:         asanaTags,
					YouTrackSubsystem: "",
					TagMismatch:       false,
				})
			} else if asanaStatus == youtrackStatus {
				analysis.Matched = append(analysis.Matched, MatchedTicket{
					AsanaTask:         task,
					YouTrackIssue:     existingIssue,
					Status:            asanaStatus,
					AsanaTags:         asanaTags,
					YouTrackSubsystem: "",
					TagMismatch:       false,
				})
			} else {
				analysis.Mismatched = append(analysis.Mismatched, MismatchedTicket{
					AsanaTask:         task,
					YouTrackIssue:     existingIssue,
					AsanaStatus:       asanaStatus,
					YouTrackStatus:    youtrackStatus,
					AsanaTags:         asanaTags,
					YouTrackSubsystem: "",
					TagMismatch:       false,
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

// Helper Functions
func getAsanaTags(task AsanaTask) []string {
	var tags []string
	for _, tag := range task.Tags {
		if tag.Name != "" {
			tags = append(tags, tag.Name)
		}
	}
	return tags
}

func mapTagToSubsystem(asanaTag string) string {
	if subsystem, exists := defaultTagMapping[asanaTag]; exists {
		return subsystem
	}

	asanaTagLower := strings.ToLower(asanaTag)
	if subsystem, exists := defaultTagMapping[asanaTagLower]; exists {
		return subsystem
	}

	return strings.ToLower(asanaTag)
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

func getYouTrackStatus(issue YouTrackIssue) string {
	for _, field := range issue.CustomFields {
		if field.Name == "State" {
			switch value := field.Value.(type) {
			case map[string]interface{}:
				if name, ok := value["localizedName"].(string); ok && name != "" {
					return name
				}
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

// FIXED: Interactive mode runs only once - simplified console
// func runInteractiveMode() {
// 	fmt.Println("=== Interactive Console Started ===")
// 	fmt.Println("Console is now running. Available HTTP endpoints:")
// 	fmt.Println("  GET /analyze - Run analysis")
// 	fmt.Println("  GET /status - Show service status")
// 	fmt.Println("  POST /auto-sync - Control auto-sync")
// 	fmt.Println("  POST /auto-create - Control auto-create")
// 	fmt.Println("  GET /tickets?type=... - Get ticket details")
// 	fmt.Println("========================================")

// 	select {}
// }
