package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
)

const (
	workspaceDir = "/root/anytype-workspace"
	spaceID      = "bafyreifambxlehn6wbjsjkzbntsfhiz4deokhzurpai7ma3xqcg7r7sx6a.10piockh34xft"
	grpcAddr     = "127.0.0.1:31010" // Actual AnyType gRPC port
)

var (
	fileTimestamps = make(map[string]time.Time)
	debounceTime   = 2 * time.Second
)

// FileChange represents a markdown file change
type FileChange struct {
	Path     string
	Filename string
	Title    string
	Content  string
}

// ParseMarkdown extracts title and content from markdown file
func ParseMarkdown(filepath string) (*FileChange, error) {
	content, err := os.ReadFile(filepath)
	if err != nil {
		return nil, err
	}

	filename := strings.TrimSuffix(filepath[strings.LastIndex(filepath, "/")+1:], ".md")

	// Extract first heading as title
	title := filename
	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "# ") {
			title = strings.TrimPrefix(line, "# ")
			break
		}
	}

	return &FileChange{
		Path:     filepath,
		Filename: filename,
		Title:    title,
		Content:  string(content),
	}, nil
}

// SyncFile processes a markdown file for sync
func SyncFile(ctx context.Context, client *AnyTypeClient, filepath string) {
	change, err := ParseMarkdown(filepath)
	if err != nil {
		fmt.Printf("[%s] ✗ Error parsing %s: %v\n", time.Now().Format(time.RFC3339), filepath, err)
		return
	}

	fmt.Printf("[%s] Syncing %s...\n", time.Now().Format(time.RFC3339), change.Filename)

	// Sync to AnyType via gRPC (if connected)
	if client == nil {
		fmt.Printf("[%s] ⚠ %s queued (gRPC client not connected)\n", time.Now().Format(time.RFC3339), change.Filename)
		return
	}

	if err := client.SyncMarkdown(ctx, change, spaceID); err != nil {
		fmt.Printf("[%s] ✗ Sync error for %s: %v\n", time.Now().Format(time.RFC3339), change.Filename, err)
		return
	}

	fmt.Printf("[%s] ✓ %s synced to AnyType\n", time.Now().Format(time.RFC3339), change.Filename)
}

// WatchDirectory monitors for markdown file changes
func WatchDirectory(ctx context.Context, dir string, client *AnyTypeClient, watcher *fsnotify.Watcher) error {
	// Add root directory
	if err := watcher.Add(dir); err != nil {
		return err
	}

	// Add subdirectories
	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() && path != dir {
			watcher.Add(path)
		}
		return nil
	})

	fmt.Printf("[%s] Watching %s for changes...\n", time.Now().Format(time.RFC3339), dir)

	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return nil
			}

			// Only process .md files
			if !strings.HasSuffix(event.Name, ".md") {
				continue
			}

			// Check if event is recent (debounce)
			now := time.Now()
			if lastChange, exists := fileTimestamps[event.Name]; exists {
				if now.Sub(lastChange) < debounceTime {
					continue
				}
			}
			fileTimestamps[event.Name] = now

			// Wait for file to stabilize
			time.Sleep(debounceTime)

			// Check if file still exists
			if _, err := os.Stat(event.Name); err == nil {
				SyncFile(ctx, client, event.Name)
			}

		case err, ok := <-watcher.Errors:
			if !ok {
				return nil
			}
			fmt.Printf("[%s] Watcher error: %v\n", time.Now().Format(time.RFC3339), err)
		}
	}
}

// InitialSync syncs all existing markdown files
func InitialSync(ctx context.Context, dir string, client *AnyTypeClient) error {
	fmt.Printf("[%s] Running initial sync...\n", time.Now().Format(time.RFC3339))

	files, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".md") {
			SyncFile(ctx, client, filepath.Join(dir, file.Name()))
		}
	}

	fmt.Printf("[%s] Initial sync complete\n", time.Now().Format(time.RFC3339))
	return nil
}

func main() {
	ctx := context.Background()

	// Check workspace directory exists
	if _, err := os.Stat(workspaceDir); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "Error: %s does not exist\n", workspaceDir)
		os.Exit(1)
	}

	// Create file watcher
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create watcher: %v\n", err)
		os.Exit(1)
	}
	defer watcher.Close()

	// Connect to AnyType gRPC (optional - continue if connection fails)
	fmt.Printf("[%s] Connecting to AnyType at %s...\n", time.Now().Format(time.RFC3339), grpcAddr)
	client, err := NewAnyTypeClient(grpcAddr)
	if err != nil {
		fmt.Printf("[%s] WARNING: Failed to connect to AnyType: %v\n", time.Now().Format(time.RFC3339), err)
		fmt.Printf("[%s] Watcher will run but sync will be disabled until connection succeeds\n", time.Now().Format(time.RFC3339))
		client = nil
	} else {
		defer client.Close()
		fmt.Printf("[%s] Connected to AnyType\n", time.Now().Format(time.RFC3339))

		// Health check
		if err := client.HealthCheck(ctx); err != nil {
			fmt.Printf("[%s] WARNING: Health check failed: %v\n", time.Now().Format(time.RFC3339), err)
		}

		// Open the space so we can create objects in it
		fmt.Printf("[%s] Opening space %s...\n", time.Now().Format(time.RFC3339), spaceID)
		if err := client.OpenSpace(ctx, spaceID); err != nil {
			fmt.Printf("[%s] WARNING: Failed to open space: %v\n", time.Now().Format(time.RFC3339), err)
			fmt.Printf("[%s] Will continue but sync may fail\n", time.Now().Format(time.RFC3339))
		}
	}

	// Initial sync
	if err := InitialSync(ctx, workspaceDir, client); err != nil {
		fmt.Fprintf(os.Stderr, "Initial sync failed: %v\n", err)
		os.Exit(1)
	}

	// Start watching
	if err := WatchDirectory(ctx, workspaceDir, client, watcher); err != nil {
		fmt.Fprintf(os.Stderr, "Watch failed: %v\n", err)
		os.Exit(1)
	}
}
