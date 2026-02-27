package main

import (
	"context"
	"fmt"
	"time"

	"github.com/anyproto/anytype-heart/pb"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/structpb"
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
	if err := c.setObjectDetails(ctx, objectID, change.Title, change.Content); err != nil {
		return fmt.Errorf("failed to set object details: %w", err)
	}

	fmt.Printf("[%s] gRPC: Object '%s' synced successfully\n", time.Now().Format(time.RFC3339), change.Title)
	return nil
}

// createObject invokes ObjectCreate RPC to create a new AnyType object
func (c *AnyTypeClient) createObject(ctx context.Context, title string, spaceID string) (string, error) {
	fmt.Printf("[%s]   → Creating object: type=page, title='%s'\n", time.Now().Format(time.RFC3339), title)

	// Build details struct
	details, err := structpb.NewStruct(map[string]interface{}{
		"name": title,
	})
	if err != nil {
		return "", fmt.Errorf("failed to create details struct: %w", err)
	}

	// Create request with space ID
	req := &pb.RpcObjectCreateRequest{
		SpaceId: spaceID,
		Details: details,
	}

	// Call ObjectCreate RPC
	resp, err := pb.NewClientCommandsClient(c.conn).ObjectCreate(ctx, req)
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

// setObjectDetails invokes ObjectSetDetails RPC to update object properties
func (c *AnyTypeClient) setObjectDetails(ctx context.Context, objectID string, title string, content string) error {
	fmt.Printf("[%s]   → Setting details on object: title='%s', content_len=%d bytes\n",
		time.Now().Format(time.RFC3339), title, len(content))

	// Create request with object details
	req := &pb.RpcObjectSetDetailsRequest{
		ContextId: objectID,
		Details: []*pb.Detail{
			{
				Key:   "name",
				Value: structpb.NewStringValue(title),
			},
			{
				Key:   "description",
				Value: structpb.NewStringValue(content),
			},
		},
	}

	// Call ObjectSetDetails RPC
	resp, err := pb.NewClientCommandsClient(c.conn).ObjectSetDetails(ctx, req)
	if err != nil {
		return c.handleGRPCError(err)
	}

	// Check response error
	if resp.Error != nil && resp.Error.Code != pb.RpcObjectSetDetailsResponseError_NULL {
		return fmt.Errorf("ObjectSetDetails failed: %s (%s)", resp.Error.Description, resp.Error.Code)
	}

	fmt.Printf("[%s]   → Details updated successfully\n", time.Now().Format(time.RFC3339))
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
