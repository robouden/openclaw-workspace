package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
)

const (
	workspaceDir = "/root/anytype-workspace"
	spaceID      = "bafyreietc6lmsanpkyfz4m3x2xd4hb5vvxex7ywalouqcugufarmhy3nue.10piockh34xft"
	grpcAddr     = "127.0.0.1:31011"
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
func SyncFile(filepath string) {
	change, err := ParseMarkdown(filepath)
	if err != nil {
		fmt.Printf("[%s] ✗ Error parsing %s: %v\n", time.Now().Format(time.RFC3339), filepath, err)
		return
	}

	fmt.Printf("[%s] Syncing %s...\n", time.Now().Format(time.RFC3339), change.Filename)

	// TODO: Implement gRPC sync to AnyType
	// For now, just log that file is ready
	fmt.Printf("[%s] ✓ %s ready for gRPC sync\n", time.Now().Format(time.RFC3339), change.Filename)
}

// WatchDirectory monitors for markdown file changes
func WatchDirectory(dir string, watcher *fsnotify.Watcher) error {
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
				SyncFile(event.Name)
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
func InitialSync(dir string) error {
	fmt.Printf("[%s] Running initial sync...\n", time.Now().Format(time.RFC3339))

	files, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".md") {
			SyncFile(filepath.Join(dir, file.Name()))
		}
	}

	fmt.Printf("[%s] Initial sync complete\n", time.Now().Format(time.RFC3339))
	return nil
}

func main() {
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

	// Initial sync
	if err := InitialSync(workspaceDir); err != nil {
		fmt.Fprintf(os.Stderr, "Initial sync failed: %v\n", err)
		os.Exit(1)
	}

	// Start watching
	if err := WatchDirectory(workspaceDir, watcher); err != nil {
		fmt.Fprintf(os.Stderr, "Watch failed: %v\n", err)
		os.Exit(1)
	}
}
