package main

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// AnyTypeClient wraps gRPC connection to AnyType
type AnyTypeClient struct {
	conn *grpc.ClientConn
	addr string
}

// NewAnyTypeClient creates a new gRPC client for AnyType
func NewAnyTypeClient(addr string) (*AnyTypeClient, error) {
	client := &AnyTypeClient{
		addr: addr,
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

// SyncMarkdown syncs a markdown file to AnyType
// TODO: Implement actual gRPC calls once proto definitions are available
func (c *AnyTypeClient) SyncMarkdown(ctx context.Context, change *FileChange, spaceID string) error {
	if c.conn == nil {
		return fmt.Errorf("gRPC client not connected")
	}

	fmt.Printf("[%s] gRPC: Syncing %s to space %s\n", time.Now().Format(time.RFC3339), change.Filename, spaceID)

	// TODO: Replace with actual gRPC calls
	// Steps:
	// 1. Create or update object in space
	// 2. Map markdown content to AnyType data model
	// 3. Handle sync conflicts/versioning
	//
	// Example structure (to be confirmed with actual API):
	// - Call RPC to create/update object
	// - Pass spaceID, object type, markdown content
	// - Handle errors and retries

	return nil
}

// Close closes the gRPC connection
func (c *AnyTypeClient) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
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
