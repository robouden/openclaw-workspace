package main

import (
	"context"
	"fmt"
	"time"

	"github.com/anyproto/anytype-heart/pb"
	"github.com/anyproto/anytype-heart/pb/service"
	"github.com/gogo/protobuf/types"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// openSpaceRPC opens a space via gRPC so we can create objects in it
func (c *AnyTypeClient) openSpaceRPC(ctx context.Context, spaceID string) error {
	fmt.Printf("[%s] gRPC: Opening workspace/space %s...\n", time.Now().Format(time.RFC3339), spaceID)

	// Create gRPC client stub
	client := service.NewClientCommandsClient(c.conn)

	// Add authentication to context
	ctx = c.withAuth(ctx)

	// Create request
	req := &pb.RpcWorkspaceOpenRequest{
		SpaceId: spaceID,
	}

	// Call WorkspaceOpen RPC
	resp, err := client.WorkspaceOpen(ctx, req)
	if err != nil {
		return c.handleGRPCError(err)
	}

	// Check response error
	if resp.Error != nil && resp.Error.Code != pb.RpcWorkspaceOpenResponseError_NULL {
		return fmt.Errorf("WorkspaceOpen failed: %s (%s)", resp.Error.Description, resp.Error.Code)
	}

	fmt.Printf("[%s] gRPC: Workspace/space opened successfully\n", time.Now().Format(time.RFC3339))
	return nil
}

// SyncMarkdownToAnyType creates or updates a page in AnyType from markdown
func (c *AnyTypeClient) SyncMarkdownToAnyType(ctx context.Context, change *FileChange, spaceID string) (string, error) {
	if c.conn == nil {
		return "", fmt.Errorf("not connected to AnyType")
	}

	fmt.Printf("[%s] gRPC: Creating/updating '%s' in AnyType\n", time.Now().Format(time.RFC3339), change.Title)

	// Create a new object (page) in the space with title and content
	objectID, err := c.createObject(ctx, change.Title, change.Content, spaceID)
	if err != nil {
		return "", fmt.Errorf("failed to create object: %w", err)
	}

	fmt.Printf("[%s] gRPC: Created/updated object '%s' successfully (ID: %s)\n", time.Now().Format(time.RFC3339), change.Title, objectID)
	return objectID, nil
}

// createObject invokes ObjectCreate RPC to create a new AnyType object
func (c *AnyTypeClient) createObject(ctx context.Context, title string, content string, spaceID string) (string, error) {
	fmt.Printf("[%s]   → Creating object: title='%s', content_len=%d bytes\n", time.Now().Format(time.RFC3339), title, len(content))

	// Create gRPC client stub
	client := service.NewClientCommandsClient(c.conn)

	// Add authentication to context
	ctx = c.withAuth(ctx)

	// Create details struct with title and content
	details := &types.Struct{
		Fields: map[string]*types.Value{
			"name": {
				Kind: &types.Value_StringValue{
					StringValue: title,
				},
			},
			"description": {
				Kind: &types.Value_StringValue{
					StringValue: content,
				},
			},
		},
	}

	// Create request with space ID and object details
	// Use "ot-note" as the object type (AnyType note type)
	req := &pb.RpcObjectCreateRequest{
		SpaceId:              spaceID,
		Details:              details,
		ObjectTypeUniqueKey:  "ot-note",
		InternalFlags:        nil,
	}

	// Call ObjectCreate RPC
	resp, err := client.ObjectCreate(ctx, req)
	if err != nil {
		return "", c.handleGRPCError(err)
	}

	// Check response error
	if resp.Error != nil && resp.Error.Code != pb.RpcObjectCreateResponseError_NULL {
		return "", fmt.Errorf("ObjectCreate failed: %s (%s)", resp.Error.Description, resp.Error.Code)
	}

	objectID := resp.ObjectId
	fmt.Printf("[%s]   → Created object ID: %s\n", time.Now().Format(time.RFC3339), objectID)
	return objectID, nil
}

// deleteObject invokes ObjectListDelete RPC to delete an AnyType object
func (c *AnyTypeClient) deleteObject(ctx context.Context, objectID string) error {
	fmt.Printf("[%s]   → Deleting object ID: %s\n", time.Now().Format(time.RFC3339), objectID)

	// Create gRPC client stub
	client := service.NewClientCommandsClient(c.conn)

	// Add authentication to context
	ctx = c.withAuth(ctx)

	// Create request to delete the object
	req := &pb.RpcObjectListDeleteRequest{
		ObjectIds: []string{objectID},
	}

	// Call ObjectListDelete RPC
	resp, err := client.ObjectListDelete(ctx, req)
	if err != nil {
		return c.handleGRPCError(err)
	}

	// Check response error
	if resp.Error != nil && resp.Error.Code != pb.RpcObjectListDeleteResponseError_NULL {
		return fmt.Errorf("ObjectListDelete failed: %s (%s)", resp.Error.Description, resp.Error.Code)
	}

	fmt.Printf("[%s]   → Successfully deleted object\n", time.Now().Format(time.RFC3339))
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
		return fmt.Errorf("AnyType service unavailable - check if AnyType is running")
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
	case codes.Unauthenticated:
		return fmt.Errorf("not authenticated - check network membership")
	default:
		return fmt.Errorf("gRPC error %s: %s", st.Code(), st.Message())
	}
}
