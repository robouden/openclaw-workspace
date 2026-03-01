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
	spaceID      = "bafyreig4q7t3vt7b7zmvfv3emj7jfrvjamuhu4crws3dhn3uaxhh3u37k4.10piockh34xft"
	grpcAddr     = "127.0.0.1:31010" // Actual AnyType gRPC port
)

var (
	fileTimestamps = make(map[string]time.Time)
	debounceTime   = 2 * time.Second
	objectMap      *ObjectMap
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
func SyncFile(ctx context.Context, client *AnyTypeClient, filepath string) (string, error) {
	change, err := ParseMarkdown(filepath)
	if err != nil {
		fmt.Printf("[%s] ✗ Error parsing %s: %v\n", time.Now().Format(time.RFC3339), filepath, err)
		return "", err
	}

	fmt.Printf("[%s] Syncing %s...\n", time.Now().Format(time.RFC3339), change.Filename)

	// Sync to AnyType via gRPC (if connected)
	if client == nil {
		fmt.Printf("[%s] ⚠ %s queued (gRPC client not connected)\n", time.Now().Format(time.RFC3339), change.Filename)
		return "", fmt.Errorf("client not connected")
	}

	// Get object ID from the sync operation
	objectID, err := client.SyncMarkdownWithID(ctx, change, spaceID)
	if err != nil {
		fmt.Printf("[%s] ✗ Sync error for %s: %v\n", time.Now().Format(time.RFC3339), change.Filename, err)
		return "", err
	}

	// Store the object ID mapping
	if objectMap != nil {
		if err := objectMap.Set(change.Filename, objectID); err != nil {
			fmt.Printf("[%s] ⚠ Failed to save object mapping: %v\n", time.Now().Format(time.RFC3339), err)
		}
	}

	fmt.Printf("[%s] ✓ %s synced to AnyType\n", time.Now().Format(time.RFC3339), change.Filename)
	return objectID, nil
}

// DeleteFile processes a markdown file deletion
func DeleteFile(ctx context.Context, client *AnyTypeClient, filepath string) {
	filename := strings.TrimSuffix(filepath[strings.LastIndex(filepath, "/")+1:], ".md")

	fmt.Printf("[%s] Deleting %s...\n", time.Now().Format(time.RFC3339), filename)

	// Delete from AnyType via gRPC (if connected)
	if client == nil {
		fmt.Printf("[%s] ⚠ %s delete queued (gRPC client not connected)\n", time.Now().Format(time.RFC3339), filename)
		return
	}

	// Get object ID from mapping
	if objectMap == nil {
		fmt.Printf("[%s] ✗ Object map not initialized\n", time.Now().Format(time.RFC3339))
		return
	}

	objectID, exists := objectMap.Get(filename)
	if !exists {
		fmt.Printf("[%s] ⚠ No object ID found for %s (may have been deleted already)\n", time.Now().Format(time.RFC3339), filename)
		return
	}

	if err := client.DeleteMarkdown(ctx, objectID); err != nil {
		fmt.Printf("[%s] ✗ Delete error for %s: %v\n", time.Now().Format(time.RFC3339), filename, err)
		return
	}

	// Remove from object map
	if err := objectMap.Delete(filename); err != nil {
		fmt.Printf("[%s] ⚠ Failed to update object mapping: %v\n", time.Now().Format(time.RFC3339), err)
	}

	fmt.Printf("[%s] ✓ %s deleted from AnyType\n", time.Now().Format(time.RFC3339), filename)
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

			// Handle different event types
			if event.Op&fsnotify.Remove == fsnotify.Remove {
				// File was deleted
				DeleteFile(ctx, client, event.Name)
			} else {
				// Wait for file to stabilize
				time.Sleep(debounceTime)

				// Check if file still exists (for create/write events)
				if _, err := os.Stat(event.Name); err == nil {
					SyncFile(ctx, client, event.Name)
				}
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

	// Initialize object map
	var err error
	objectMap, err = NewObjectMap()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize object map: %v\n", err)
		os.Exit(1)
	}

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
