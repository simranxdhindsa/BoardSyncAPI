package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"service":   "enhanced-asana-youtrack-sync",
		"timestamp": time.Now().Format(time.RFC3339),
		"version":   "3.0", // Updated version for tag support
		"features": []string{
			"Tag/Subsystem synchronization",
			"Individual ticket creation",
			"Enhanced status parsing",
			"Tag mismatch detection",
		},
		"columns": map[string]interface{}{
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
		"columns": map[string]interface{}{
			"syncable":     syncableColumns,
			"display_only": displayOnlyColumns,
		},
		"temp_ignored":    len(ignoredTicketsTemp),
		"forever_ignored": len(ignoredTicketsForever),
		"tag_mappings":    len(defaultTagMapping),
		"endpoints": []string{
			"GET /health - Health check",
			"GET /status - Service status", 
			"GET /analyze - Analyze ticket differences",
			"POST /create - Create missing tickets (bulk)",
			"POST /create-single - Create individual ticket", // NEW ENDPOINT
			"GET/POST /sync - Sync mismatched tickets",
			"GET/POST /ignore - Manage ignored tickets",
		},
	})
}

func analyzeTicketsHandler(w http.ResponseWriter, r *http.Request) {
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

	// For API endpoint, analyze all columns
	analysis, err := performTicketAnalysis(allColumns)
	if err != nil {
		http.Error(w, fmt.Sprintf("Analysis failed: %v", err), http.StatusInternalServerError)
		return
	}

	// Enhanced response with tag mismatch counts
	tagMismatchCount := 0
	statusMismatchCount := 0
	for _, ticket := range analysis.Mismatched {
		if ticket.TagMismatch {
			tagMismatchCount++
		}
		if ticket.AsanaStatus != ticket.YouTrackStatus {
			statusMismatchCount++
		}
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
			"tag_mismatches":    tagMismatchCount,    // NEW
			"status_mismatches": statusMismatchCount, // NEW
		},
	})
}

func createMissingTicketsHandler(w http.ResponseWriter, r *http.Request) {
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

	analysis, err := performTicketAnalysis(syncableColumns)
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
	skipped := 0

	for _, task := range analysis.MissingYouTrack {
		asanaTags := getAsanaTags(task)
		
		result := map[string]interface{}{
			"task_id":    task.GID,
			"task_name":  task.Name,
			"asana_tags": asanaTags, // NEW: Include tags in response
		}

		if isDuplicateTicket(task.Name) {
			result["status"] = "skipped"
			result["reason"] = "Duplicate ticket already exists"
			skipped++
		} else {
			err := createYouTrackIssue(task)
			if err != nil {
				result["status"] = "failed"
				result["error"] = err.Error()
			} else {
				result["status"] = "created"
				if len(asanaTags) > 0 {
					primaryTag := asanaTags[0]
					mappedSubsystem := mapTagToSubsystem(primaryTag)
					result["mapped_subsystem"] = mappedSubsystem
				}
				created++
			}
		}
		results = append(results, result)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "completed",
		"created": created,
		"skipped": skipped,
		"total":   len(analysis.MissingYouTrack),
		"results": results,
	})
}

// NEW: Individual ticket creation endpoint
func createSingleTicketHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed. Use POST.", http.StatusMethodNotAllowed)
		return
	}

	var req CreateSingleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":    "Invalid JSON format",
			"expected": "Object like: {\"task_id\":\"1234567890\"}",
			"example":  `{"task_id":"1234567890"}`,
		})
		return
	}

	if req.TaskID == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":   "task_id is required",
			"example": `{"task_id":"1234567890"}`,
		})
		return
	}

	// Get the specific task first to show details
	allTasks, err := getAsanaTasks()
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get Asana tasks: %v", err), http.StatusInternalServerError)
		return
	}

	var targetTask *AsanaTask
	for _, task := range allTasks {
		if task.GID == req.TaskID {
			targetTask = &task
			break
		}
	}

	if targetTask == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":   "Task not found",
			"task_id": req.TaskID,
		})
		return
	}

	asanaTags := getAsanaTags(*targetTask)

	// Check for duplicates
	if isDuplicateTicket(targetTask.Name) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":     "skipped",
			"reason":     "Duplicate ticket already exists",
			"task_id":    req.TaskID,
			"task_name":  targetTask.Name,
			"asana_tags": asanaTags,
		})
		return
	}

	// Create the ticket
	err = createYouTrackIssue(*targetTask)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":     "failed",
			"error":      err.Error(),
			"task_id":    req.TaskID,
			"task_name":  targetTask.Name,
			"asana_tags": asanaTags,
		})
		return
	}

	// Success response with tag information
	response := map[string]interface{}{
		"status":     "created",
		"task_id":    req.TaskID,
		"task_name":  targetTask.Name,
		"asana_tags": asanaTags,
	}

	if len(asanaTags) > 0 {
		primaryTag := asanaTags[0]
		mappedSubsystem := mapTagToSubsystem(primaryTag)
		response["mapped_subsystem"] = mappedSubsystem
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func syncMismatchedTicketsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method == "GET" {
		analysis, err := performTicketAnalysis(syncableColumns)
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
			"note": "Sync now includes both status and tag/subsystem synchronization",
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

	analysis, err := performTicketAnalysis(syncableColumns)
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
				result["status_change"] = map[string]string{
					"from": ticket.YouTrackStatus,
					"to":   ticket.AsanaStatus,
				}
				
				// Include tag sync information
				asanaTags := getAsanaTags(ticket.AsanaTask)
				if len(asanaTags) > 0 {
					primaryTag := asanaTags[0]
					mappedSubsystem := mapTagToSubsystem(primaryTag)
					result["tag_sync"] = map[string]interface{}{
						"asana_tags":         asanaTags,
						"mapped_subsystem":   mappedSubsystem,
						"previous_subsystem": ticket.YouTrackSubsystem,
					}
				}
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
		"note":    "Sync operations now include both status and tag/subsystem updates",
	})
}

func manageIgnoredTicketsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	switch r.Method {
	case "GET":
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"temp_ignored":    getMapKeys(ignoredTicketsTemp),
			"forever_ignored": getMapKeys(ignoredTicketsForever),
			"tag_mappings":    defaultTagMapping, // NEW: Show available tag mappings
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