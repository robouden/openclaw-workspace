package main

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/anyproto/anytype-heart/pb"
	"github.com/anyproto/anytype-heart/pkg/lib/pb/model"
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

	// Create a new object (page) in the space with the title
	objectID, err := c.createObject(ctx, change.Title, spaceID)
	if err != nil {
		return "", fmt.Errorf("failed to create object: %w", err)
	}

	// Add the markdown content as body blocks (separate step — details only holds metadata)
	if err := c.addContentBlocks(ctx, objectID, spaceID, change.Content); err != nil {
		fmt.Printf("[%s] gRPC: Warning: failed to add content blocks: %v\n", time.Now().Format(time.RFC3339), err)
	}

	fmt.Printf("[%s] gRPC: Created/updated object '%s' successfully (ID: %s)\n", time.Now().Format(time.RFC3339), change.Title, objectID)
	return objectID, nil
}

// createObject invokes ObjectCreate RPC to create a new AnyType object with a title
func (c *AnyTypeClient) createObject(ctx context.Context, title string, spaceID string) (string, error) {
	fmt.Printf("[%s]   → Creating object: title='%s'\n", time.Now().Format(time.RFC3339), title)

	// Create gRPC client stub
	client := service.NewClientCommandsClient(c.conn)

	// Add authentication to context
	ctx = c.withAuth(ctx)

	// Details only holds metadata — body content is added separately via BlockPaste
	details := &types.Struct{
		Fields: map[string]*types.Value{
			"name": {
				Kind: &types.Value_StringValue{
					StringValue: title,
				},
			},
		},
	}

	// Create request with space ID and object details
	// Use "ot-note" as the object type (AnyType note type)
	req := &pb.RpcObjectCreateRequest{
		SpaceId:             spaceID,
		Details:             details,
		ObjectTypeUniqueKey: "ot-note",
		InternalFlags:       nil,
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

// addContentBlocks writes markdown text as paragraph blocks into the body of an AnyType object.
// It uses ObjectShow to locate the correct anchor point in the block tree, then chains
// BlockCreate calls so each line lands in the visible document body.
func (c *AnyTypeClient) addContentBlocks(ctx context.Context, objectID string, spaceID string, content string) error {
	fmt.Printf("[%s]   → Adding content blocks (%d bytes)\n", time.Now().Format(time.RFC3339), len(content))

	// Get the current block tree to find where body content should be inserted
	rootID, blocks, err := c.getObjectBlocks(ctx, objectID, spaceID)
	if err != nil {
		return fmt.Errorf("failed to read block tree: %w", err)
	}

	// Build id→block map and find the last child of root (the header block) as anchor
	blockMap := make(map[string]*model.Block, len(blocks))
	for _, b := range blocks {
		blockMap[b.Id] = b
	}
	anchorID := ""
	if root := blockMap[rootID]; root != nil && len(root.ChildrenIds) > 0 {
		anchorID = root.ChildrenIds[len(root.ChildrenIds)-1]
	}

	// Create one block per non-empty line, parsing markdown into native block styles
	created := 0
	for _, line := range strings.Split(content, "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		style, text, marks := parseMarkdownLine(line)
		newID, err := c.createTextBlock(ctx, objectID, anchorID, style, text, marks)
		if err != nil {
			return fmt.Errorf("failed to create block: %w", err)
		}
		anchorID = newID
		created++
	}

	fmt.Printf("[%s]   → Content blocks added (%d blocks)\n", time.Now().Format(time.RFC3339), created)
	return nil
}

// getObjectBlocks calls ObjectShow and returns the root block ID and full block list.
func (c *AnyTypeClient) getObjectBlocks(ctx context.Context, objectID string, spaceID string) (string, []*model.Block, error) {
	client := service.NewClientCommandsClient(c.conn)
	ctx = c.withAuth(ctx)

	resp, err := client.ObjectShow(ctx, &pb.RpcObjectShowRequest{
		ObjectId: objectID,
		SpaceId:  spaceID,
	})
	if err != nil {
		return "", nil, c.handleGRPCError(err)
	}
	if resp.Error != nil && resp.Error.Code != pb.RpcObjectShowResponseError_NULL {
		return "", nil, fmt.Errorf("ObjectShow failed: %s", resp.Error.Description)
	}

	view := resp.ObjectView
	return view.RootId, view.Blocks, nil
}

// createTextBlock creates a single block after anchorID with the given style, text, and inline marks.
func (c *AnyTypeClient) createTextBlock(ctx context.Context, objectID string, anchorID string, style model.BlockContentTextStyle, text string, marks []*model.BlockContentTextMark) (string, error) {
	client := service.NewClientCommandsClient(c.conn)
	ctx = c.withAuth(ctx)

	position := model.Block_Inner
	if anchorID != "" {
		position = model.Block_Bottom
	}

	req := &pb.RpcBlockCreateRequest{
		ContextId: objectID,
		TargetId:  anchorID,
		Block: &model.Block{
			Content: &model.BlockContentOfText{
				Text: &model.BlockContentText{
					Text:  text,
					Style: style,
					Marks: &model.BlockContentTextMarks{Marks: marks},
				},
			},
		},
		Position: position,
	}

	resp, err := client.BlockCreate(ctx, req)
	if err != nil {
		return "", c.handleGRPCError(err)
	}
	if resp.Error != nil && resp.Error.Code != pb.RpcBlockCreateResponseError_NULL {
		return "", fmt.Errorf("BlockCreate failed: %s", resp.Error.Description)
	}

	return resp.BlockId, nil
}

// parseMarkdownLine converts a markdown line into a block style, clean text, and inline marks.
func parseMarkdownLine(line string) (model.BlockContentTextStyle, string, []*model.BlockContentTextMark) {
	style := model.BlockContentText_Paragraph
	text := line

	switch {
	case strings.HasPrefix(line, "#### "):
		style = model.BlockContentText_Header4
		text = line[5:]
	case strings.HasPrefix(line, "### "):
		style = model.BlockContentText_Header3
		text = line[4:]
	case strings.HasPrefix(line, "## "):
		style = model.BlockContentText_Header2
		text = line[3:]
	case strings.HasPrefix(line, "# "):
		style = model.BlockContentText_Header1
		text = line[2:]
	case strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "* "):
		style = model.BlockContentText_Marked
		text = line[2:]
	case strings.HasPrefix(line, "> "):
		style = model.BlockContentText_Quote
		text = line[2:]
	default:
		// Numbered list: "1. ", "12. ", etc.
		i := 0
		for i < len(line) && line[i] >= '0' && line[i] <= '9' {
			i++
		}
		if i > 0 && i+2 <= len(line) && line[i] == '.' && line[i+1] == ' ' {
			style = model.BlockContentText_Numbered
			text = line[i+2:]
		}
	}

	cleanText, marks := parseInlineMarks(text)
	return style, cleanText, marks
}

// parseInlineMarks strips **bold**, *italic*, and `code` markdown syntax from text
// and returns the clean string along with AnyType mark ranges.
func parseInlineMarks(text string) (string, []*model.BlockContentTextMark) {
	var marks []*model.BlockContentTextMark
	var out strings.Builder
	runes := []rune(text)
	n := len(runes)
	i := 0

	for i < n {
		// Bold: **text** or __text__
		if i+1 < n && ((runes[i] == '*' && runes[i+1] == '*') || (runes[i] == '_' && runes[i+1] == '_')) {
			delim := string(runes[i : i+2])
			rest := string(runes[i+2:])
			end := strings.Index(rest, delim)
			if end >= 0 {
				from := int32(len([]rune(out.String())))
				inner := string(runes[i+2 : i+2+end])
				out.WriteString(inner)
				marks = append(marks, &model.BlockContentTextMark{
					Range: &model.Range{From: from, To: from + int32(len([]rune(inner)))},
					Type:  model.BlockContentTextMark_Bold,
				})
				i = i + 2 + end + 2
				continue
			}
		}

		// Italic: *text* or _text_ (single, not preceded by same char)
		if (runes[i] == '*' || runes[i] == '_') && (i+1 < n && runes[i+1] != runes[i]) {
			delim := string(runes[i])
			rest := string(runes[i+1:])
			end := strings.Index(rest, delim)
			if end >= 0 {
				from := int32(len([]rune(out.String())))
				inner := string(runes[i+1 : i+1+end])
				out.WriteString(inner)
				marks = append(marks, &model.BlockContentTextMark{
					Range: &model.Range{From: from, To: from + int32(len([]rune(inner)))},
					Type:  model.BlockContentTextMark_Italic,
				})
				i = i + 1 + end + 1
				continue
			}
		}

		// Inline code: `text`
		if runes[i] == '`' {
			rest := string(runes[i+1:])
			end := strings.Index(rest, "`")
			if end >= 0 {
				from := int32(len([]rune(out.String())))
				inner := string(runes[i+1 : i+1+end])
				out.WriteString(inner)
				marks = append(marks, &model.BlockContentTextMark{
					Range: &model.Range{From: from, To: from + int32(len([]rune(inner)))},
					Type:  model.BlockContentTextMark_Keyboard,
				})
				i = i + 1 + end + 1
				continue
			}
		}

		out.WriteRune(runes[i])
		i++
	}

	return out.String(), marks
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

// detectFileType determines the file type based on file extension
func detectFileType(filePath string) model.BlockContentFileType {
	ext := strings.ToLower(filepath.Ext(filePath))

	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg":
		return model.BlockContentFile_Image
	case ".pdf":
		return model.BlockContentFile_PDF
	case ".mp4", ".mov", ".avi", ".mkv", ".webm":
		return model.BlockContentFile_Video
	case ".mp3", ".wav", ".ogg", ".m4a", ".flac":
		return model.BlockContentFile_Audio
	default:
		return model.BlockContentFile_File
	}
}

// uploadFile uploads a file (image, PDF, etc.) to AnyType
func (c *AnyTypeClient) uploadFile(ctx context.Context, filePath string, spaceID string) (string, error) {
	// Detect file type from extension
	fileType := detectFileType(filePath)

	fmt.Printf("[%s]   → Uploading file: %s (type: %s)\n", time.Now().Format(time.RFC3339), filePath, fileType)

	// Create gRPC client stub
	client := service.NewClientCommandsClient(c.conn)

	// Add authentication to context
	ctx = c.withAuth(ctx)

	// Create request with local file path
	req := &pb.RpcFileUploadRequest{
		SpaceId:   spaceID,
		LocalPath: filePath,
		Type:      fileType,
	}

	// Call FileUpload RPC
	resp, err := client.FileUpload(ctx, req)
	if err != nil {
		return "", c.handleGRPCError(err)
	}

	// Check response error
	if resp.Error != nil && resp.Error.Code != pb.RpcFileUploadResponseError_NULL {
		return "", fmt.Errorf("FileUpload failed: %s (%s)", resp.Error.Description, resp.Error.Code)
	}

	objectID := resp.ObjectId
	fmt.Printf("[%s]   → Uploaded file successfully (Object ID: %s)\n", time.Now().Format(time.RFC3339), objectID)
	return objectID, nil
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
