package main

import "time"

// Configuration structure
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

// Asana data structures
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
	// NEW: Added tag support for Asana tasks
	Tags []struct {
		GID  string `json:"gid"`
		Name string `json:"name"`
	} `json:"tags"`
}

type AsanaResponse struct {
	Data []AsanaTask `json:"data"`
}

// YouTrack data structures
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
	Project struct {
		ShortName string `json:"shortName"`
	} `json:"project"`
}

// Analysis result structures
type TicketAnalysis struct {
	SelectedColumn   string             `json:"selected_column"`
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
	// NEW: Added tag/subsystem fields for matched tickets
	AsanaTags         []string `json:"asana_tags"`
	YouTrackSubsystem string   `json:"youtrack_subsystem"`
	TagMismatch       bool     `json:"tag_mismatch"`
}

type MismatchedTicket struct {
	AsanaTask      AsanaTask     `json:"asana_task"`
	YouTrackIssue  YouTrackIssue `json:"youtrack_issue"`
	AsanaStatus    string        `json:"asana_status"`
	YouTrackStatus string        `json:"youtrack_status"`
	// NEW: Added tag/subsystem fields for mismatched tickets
	AsanaTags         []string `json:"asana_tags"`
	YouTrackSubsystem string   `json:"youtrack_subsystem"`
	TagMismatch       bool     `json:"tag_mismatch"`
}

type FindingsAlert struct {
	AsanaTask      AsanaTask     `json:"asana_task"`
	YouTrackIssue  YouTrackIssue `json:"youtrack_issue"`
	YouTrackStatus string        `json:"youtrack_status"`
	AlertMessage   string        `json:"alert_message"`
}

// API request structures
type SyncRequest struct {
	TicketID string `json:"ticket_id"`
	Action   string `json:"action"`
}

// NEW: Single ticket creation request
type CreateSingleRequest struct {
	TaskID string `json:"task_id"`
}

type IgnoreRequest struct {
	TicketID string `json:"ticket_id"`
	Action   string `json:"action"`
	Type     string `json:"type"`
}

// NEW: Auto-sync control structures
type AutoSyncRequest struct {
	Action   string `json:"action"`   // "start" or "stop"
	Interval int    `json:"interval"` // interval in seconds (optional, defaults to 60)
}

type AutoSyncStatus struct {
	Running      bool      `json:"running"`
	Interval     int       `json:"interval"`
	LastSync     time.Time `json:"last_sync"`
	NextSync     time.Time `json:"next_sync"`
	SyncCount    int       `json:"sync_count"`
	LastSyncInfo string    `json:"last_sync_info"`
}

// NEW: Tag mapping configuration
type TagMapping struct {
	AsanaTag          string `json:"asana_tag"`
	YouTrackSubsystem string `json:"youtrack_subsystem"`
}

// Global variables
var config Config
var lastSyncTime time.Time
var ignoredTicketsTemp = make(map[string]bool)
var ignoredTicketsForever = make(map[string]bool)

// NEW: Auto-sync global variables
var autoSyncRunning = false
var autoSyncInterval = 60 // seconds
var autoSyncTicker *time.Ticker
var autoSyncDone chan bool
var autoSyncCount = 0
var autoSyncLastInfo = ""

// Column definitions
var syncableColumns = []string{"backlog", "in progress", "dev", "stage", "blocked"}
var displayOnlyColumns = []string{"ready for stage", "findings"}
var allColumns = append(syncableColumns, displayOnlyColumns...)

// NEW: Default tag-to-subsystem mapping
var defaultTagMapping = map[string]string{
	"Mobile":      "mobile",
	"Web":         "web",
	"API":         "backend",
	"Frontend":    "frontend",
	"Backend":     "backend",
	"iOS":         "mobile",
	"Android":     "mobile",
	"Desktop":     "desktop",
	"Database":    "backend",
	"UI/UX":       "frontend",
	"DevOps":      "infrastructure",
	"QA":          "testing",
	"Testing":     "testing",
	"Security":    "security",
	"Performance": "performance",
}
