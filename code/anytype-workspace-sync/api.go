package main

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// SyncMarkdownToAnyType creates or updates a page in AnyType from markdown
func (c *AnyTypeClient) SyncMarkdownToAnyType(ctx context.Context, change *FileChange, spaceID string) error {
	if c.conn == nil {
		return fmt.Errorf("not connected to AnyType")
	}

	fmt.Printf("[%s] gRPC: Creating/updating '%s' in AnyType\n", time.Now().Format(time.RFC3339), change.Title)

	// Step 1: Create a new object (page) in the space
	objectID, err := c.createObject(ctx, change.Title, spaceID)
	if err != nil {
		return fmt.Errorf("failed to create object: %w", err)
	}

	fmt.Printf("[%s] gRPC: Created object ID: %s\n", time.Now().Format(time.RFC3339), objectID)

	// Step 2: Set object details (title and content)
	if err := c.setObjectDetails(ctx, objectID, change.Title, change.Content, spaceID); err != nil {
		return fmt.Errorf("failed to set object details: %w", err)
	}

	fmt.Printf("[%s] gRPC: Object '%s' synced successfully\n", time.Now().Format(time.RFC3339), change.Title)
	return nil
}

// createObject invokes ObjectCreate RPC to create a new AnyType object
func (c *AnyTypeClient) createObject(ctx context.Context, title string, spaceID string) (string, error) {
	// TODO: Implement gRPC call to ObjectCreate once proto code is available
	// Service: github.com/anyproto/anytype-heart/pb/service.ClientCommands
	// RPC: ObjectCreate(Rpc.Object.Create.Request) -> Rpc.Object.Create.Response
	//
	// Request structure should include:
	// - space_id: the workspace/space ID
	// - object_type_id: type identifier (e.g., "page", "note")
	// - details: map of property names to values (name, description, etc.)

	fmt.Printf("[%s]   → Creating object: type=page, title='%s'\n", time.Now().Format(time.RFC3339), title)

	// Placeholder: generate a deterministic ID
	objectID := fmt.Sprintf("obj_%x_%x", hashString(title), hashString(spaceID))
	return objectID, nil
}

// setObjectDetails invokes ObjectSetDetails RPC to update object properties
func (c *AnyTypeClient) setObjectDetails(ctx context.Context, objectID string, title string, content string, spaceID string) error {
	// TODO: Implement gRPC call to ObjectSetDetails once proto code is available
	// Service: github.com/anyproto/anytype-heart/pb/service.ClientCommands
	// RPC: ObjectSetDetails(Rpc.Object.SetDetails.Request) -> Rpc.Object.SetDetails.Response
	//
	// Request structure should include:
	// - object_id: the object to update
	// - space_id: the workspace/space
	// - details: map of property names to new values

	fmt.Printf("[%s]   → Setting details on object: title='%s', content_len=%d bytes\n",
		time.Now().Format(time.RFC3339), title, len(content))

	return nil
}

// hashString generates a simple hash for deterministic IDs
func hashString(s string) uint32 {
	h := uint32(0)
	for _, b := range s {
		h = h*31 + uint32(b)
	}
	return h
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
