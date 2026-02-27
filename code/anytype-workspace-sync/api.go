package main

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// SyncMarkdownToAnyType creates or updates a page in AnyType from markdown
// STUB: Currently just logs what would be synced, actual gRPC calls TODO
func (c *AnyTypeClient) SyncMarkdownToAnyType(ctx context.Context, change *FileChange, spaceID string) error {
	if c.conn == nil {
		return fmt.Errorf("not connected to AnyType")
	}

	fmt.Printf("[%s] gRPC: Would sync '%s' to AnyType (STUB - not implemented yet)\n",
		time.Now().Format(time.RFC3339), change.Title)
	fmt.Printf("[%s]   → Space ID: %s\n", time.Now().Format(time.RFC3339), spaceID)
	fmt.Printf("[%s]   → Title: %s\n", time.Now().Format(time.RFC3339), change.Title)
	fmt.Printf("[%s]   → Content length: %d bytes\n", time.Now().Format(time.RFC3339), len(change.Content))
	fmt.Printf("[%s]   → Path: %s\n", time.Now().Format(time.RFC3339), change.Path)

	// TODO: Implement actual gRPC calls once proto types are discovered
	// For now, just simulate success so file watcher stays active

	fmt.Printf("[%s] ⚠ File queued (gRPC sync not implemented yet)\n", time.Now().Format(time.RFC3339))
	return nil
}

// handleGRPCError provides detailed error messages for gRPC failures
func (c *AnyTypeClient) handleGRPCError(err error) error {
	if err == nil {
		return nil
	}

	st, ok := status.FromError(err)
	if !ok {
		return fmt.Errorf("unknown gRPC error: %w", err)
	}

	switch st.Code() {
	case codes.OK:
		return nil
	case codes.Unavailable:
		return fmt.Errorf("AnyType service unavailable")
	case codes.DeadlineExceeded:
		return fmt.Errorf("gRPC call timeout")
	case codes.PermissionDenied:
		return fmt.Errorf("permission denied - check credentials or space access")
	case codes.NotFound:
		return fmt.Errorf("space or object not found")
	case codes.InvalidArgument:
		return fmt.Errorf("invalid request: %s", st.Message())
	case codes.Internal:
		return fmt.Errorf("AnyType internal error: %s", st.Message())
	default:
		return fmt.Errorf("gRPC error %s: %s", st.Code(), st.Message())
	}
}
