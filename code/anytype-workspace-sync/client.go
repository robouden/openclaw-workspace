package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

// AnyTypeClient wraps gRPC connection to AnyType
type AnyTypeClient struct {
	conn          *grpc.ClientConn
	addr          string
	sessionToken  string
	refreshMutex  sync.Mutex // Prevent concurrent token refreshes
	lastRefresh   time.Time  // Track when we last refreshed
	anytypeBinary string     // Path to anytype binary
}

// NewAnyTypeClient creates a new gRPC client for AnyType
func NewAnyTypeClient(addr string) (*AnyTypeClient, error) {
	client := &AnyTypeClient{
		addr:          addr,
		anytypeBinary: "/root/.local/bin/anytype", // Default path
	}

	// Read session token from config
	token, err := readSessionToken()
	if err != nil {
		fmt.Printf("Warning: failed to read session token: %v\n", err)
	} else {
		client.sessionToken = token
	}

	// Connect to gRPC server
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(
		ctx,
		addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to AnyType gRPC: %w", err)
	}

	client.conn = conn
	return client, nil
}

// withAuth adds authentication metadata to context
func (c *AnyTypeClient) withAuth(ctx context.Context) context.Context {
	if c.sessionToken != "" {
		return metadata.AppendToOutgoingContext(ctx, "token", c.sessionToken)
	}
	return ctx
}

// readSessionToken reads the session token from AnyType config
func readSessionToken() (string, error) {
	configPath := os.Getenv("HOME") + "/.anytype/config.json"

	data, err := os.ReadFile(configPath)
	if err != nil {
		return "", fmt.Errorf("failed to read config: %w", err)
	}

	var config struct {
		SessionToken string `json:"sessionToken"`
	}

	if err := json.Unmarshal(data, &config); err != nil {
		return "", fmt.Errorf("failed to parse config: %w", err)
	}

	return config.SessionToken, nil
}

// isAuthError checks if an error is an authentication error
func isAuthError(err error) bool {
	if err == nil {
		return false
	}
	errMsg := strings.ToLower(err.Error())
	return strings.Contains(errMsg, "not authenticated") ||
		strings.Contains(errMsg, "authentication failed") ||
		strings.Contains(errMsg, "invalid token") ||
		strings.Contains(errMsg, "session") ||
		strings.Contains(errMsg, "signature is invalid")
}

// refreshToken attempts to refresh the session token by restarting the anytype server
func (c *AnyTypeClient) refreshToken(ctx context.Context) error {
	c.refreshMutex.Lock()
	defer c.refreshMutex.Unlock()

	// Check if we recently refreshed (within last 30 seconds)
	// This prevents rapid refresh loops
	if time.Since(c.lastRefresh) < 30*time.Second {
		fmt.Printf("[%s] Token refresh attempted too soon, skipping\n", time.Now().Format(time.RFC3339))
		return fmt.Errorf("token refresh rate limit")
	}

	fmt.Printf("[%s] 🔄 Attempting to refresh session token...\n", time.Now().Format(time.RFC3339))

	// Step 1: Kill existing anytype serve process
	fmt.Printf("[%s]   → Stopping anytype server...\n", time.Now().Format(time.RFC3339))
	killCmd := exec.Command("pkill", "-f", "anytype serve")
	if err := killCmd.Run(); err != nil {
		// It's okay if pkill fails (process may not be running)
		fmt.Printf("[%s]   ⚠ pkill returned: %v (may be normal)\n", time.Now().Format(time.RFC3339), err)
	}

	// Step 2: Wait for process to fully stop
	time.Sleep(3 * time.Second)

	// Step 3: Start anytype server in background
	fmt.Printf("[%s]   → Starting anytype server...\n", time.Now().Format(time.RFC3339))
	startCmd := exec.Command("nohup", c.anytypeBinary, "serve", "-q")

	// Redirect output to log file
	logFile, err := os.OpenFile("/tmp/anytype-serve.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("failed to open log file: %w", err)
	}
	defer logFile.Close()

	startCmd.Stdout = logFile
	startCmd.Stderr = logFile

	if err := startCmd.Start(); err != nil {
		return fmt.Errorf("failed to start anytype server: %w", err)
	}

	// Step 4: Wait for server to initialize and generate new token
	fmt.Printf("[%s]   → Waiting for server to initialize...\n", time.Now().Format(time.RFC3339))
	time.Sleep(8 * time.Second)

	// Step 5: Reload session token from config
	fmt.Printf("[%s]   → Reading new session token...\n", time.Now().Format(time.RFC3339))
	newToken, err := readSessionToken()
	if err != nil {
		return fmt.Errorf("failed to read new token: %w", err)
	}

	// Step 6: Update client's session token
	c.sessionToken = newToken
	c.lastRefresh = time.Now()

	fmt.Printf("[%s] ✓ Session token refreshed successfully\n", time.Now().Format(time.RFC3339))
	return nil
}

// withRetry wraps an operation with automatic token refresh on auth errors
func (c *AnyTypeClient) withRetry(ctx context.Context, operation func() error) error {
	err := operation()

	// If no error or not an auth error, return immediately
	if err == nil || !isAuthError(err) {
		return err
	}

	// Auth error detected - try to refresh token
	fmt.Printf("[%s] ⚠ Authentication error detected: %v\n", time.Now().Format(time.RFC3339), err)

	if refreshErr := c.refreshToken(ctx); refreshErr != nil {
		fmt.Printf("[%s] ✗ Token refresh failed: %v\n", time.Now().Format(time.RFC3339), refreshErr)
		return fmt.Errorf("auth error (token refresh failed): %w", err)
	}

	// Retry the operation with new token
	fmt.Printf("[%s] 🔁 Retrying operation with refreshed token...\n", time.Now().Format(time.RFC3339))
	err = operation()

	if err != nil {
		return fmt.Errorf("operation failed after token refresh: %w", err)
	}

	return nil
}

// SyncMarkdown syncs a markdown file to AnyType
func (c *AnyTypeClient) SyncMarkdown(ctx context.Context, change *FileChange, spaceID string) error {
	if c.conn == nil {
		return fmt.Errorf("gRPC client not connected")
	}

	fmt.Printf("[%s] gRPC: Syncing %s to space %s\n", time.Now().Format(time.RFC3339), change.Filename, spaceID)

	// Use the API layer to sync markdown to AnyType
	_, err := c.SyncMarkdownToAnyType(ctx, change, spaceID)
	return err
}

// SyncMarkdownWithID syncs a markdown file to AnyType and returns the object ID
func (c *AnyTypeClient) SyncMarkdownWithID(ctx context.Context, change *FileChange, spaceID string) (string, error) {
	if c.conn == nil {
		return "", fmt.Errorf("gRPC client not connected")
	}

	fmt.Printf("[%s] gRPC: Syncing %s to space %s\n", time.Now().Format(time.RFC3339), change.Filename, spaceID)

	var objectID string
	var syncErr error

	// Wrap the sync operation with automatic retry on auth errors
	err := c.withRetry(ctx, func() error {
		objectID, syncErr = c.SyncMarkdownToAnyType(ctx, change, spaceID)
		return syncErr
	})

	if err != nil {
		return "", err
	}

	return objectID, nil
}

// DeleteMarkdown deletes a markdown file from AnyType
func (c *AnyTypeClient) DeleteMarkdown(ctx context.Context, objectID string) error {
	if c.conn == nil {
		return fmt.Errorf("gRPC client not connected")
	}

	fmt.Printf("[%s] gRPC: Deleting object from AnyType\n", time.Now().Format(time.RFC3339))

	// Wrap the delete operation with automatic retry on auth errors
	return c.withRetry(ctx, func() error {
		return c.deleteObject(ctx, objectID)
	})
}

// Close closes the gRPC connection
func (c *AnyTypeClient) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

// OpenSpace opens/joins a space so we can create objects in it
func (c *AnyTypeClient) OpenSpace(ctx context.Context, spaceID string) error {
	if c.conn == nil {
		return fmt.Errorf("not connected")
	}

	// Wrap the open space operation with automatic retry on auth errors
	return c.withRetry(ctx, func() error {
		return c.openSpaceRPC(ctx, spaceID)
	})
}

// HealthCheck verifies connection to AnyType
func (c *AnyTypeClient) HealthCheck(ctx context.Context) error {
	if c.conn == nil {
		return fmt.Errorf("not connected")
	}

	// TODO: Implement actual health check RPC call
	fmt.Printf("[%s] gRPC: Health check placeholder\n", time.Now().Format(time.RFC3339))
	return nil
}
