# AnyType HTTP API Reference

Complete API documentation for AnyType's HTTP endpoint (port 31012).

## Base URL

```
http://127.0.0.1:31012
```

For self-hosted, replace with your server address. For cloud AnyType, use their provided endpoint.

## Authentication

All requests require the `Authorization` header with your API key:

```
Authorization: Bearer YOUR_API_KEY_HERE
```

Get your API key with:

```bash
anytype auth apikey create my-key
```

## Endpoints

### Spaces

#### List Spaces

Get all spaces available to this account.

```
GET /api/v1/spaces
```

**Response:**
```json
{
  "spaces": [
    {
      "id": "bafyrei...",
      "name": "My Workspace",
      "created": "2026-02-28T00:00:00Z",
      "status": "active"
    }
  ]
}
```

---

#### Get Space Info

Get metadata about a specific space.

```
GET /api/v1/spaces/{spaceId}
```

**Parameters:**
- `spaceId` (path): Space ID from `list-spaces`

**Response:**
```json
{
  "id": "bafyrei...",
  "name": "My Workspace",
  "created": "2026-02-28T00:00:00Z",
  "status": "active",
  "members": 1,
  "storage": {
    "used": 1024000,
    "limit": 5368709120
  }
}
```

---

### Objects (Pages/Notes)

#### Create Object

Create a new page or object in a space.

```
POST /api/v1/objects
```

**Request Body:**
```json
{
  "space": "bafyrei...",
  "name": "My Page Title",
  "type": "page",
  "content": "# Markdown content here\n\nSupports markdown formatting.",
  "tags": ["openclaw", "session", "backup"],
  "properties": {
    "category": "notes",
    "priority": "high"
  }
}
```

**Parameters:**
- `space` (required): Space ID
- `name` (required): Page title
- `type` (optional): Object type (default: `page`)
- `content` (optional): Page content (markdown)
- `tags` (optional): Array of tags
- `properties` (optional): Custom properties

**Response:**
```json
{
  "id": "obj-abc123xyz",
  "space": "bafyrei...",
  "name": "My Page Title",
  "type": "page",
  "created": "2026-02-28T10:00:00Z",
  "modified": "2026-02-28T10:00:00Z",
  "content": "# Markdown content here\n\nSupports markdown formatting.",
  "tags": ["openclaw", "session", "backup"]
}
```

---

#### Get Object

Retrieve a single page or object.

```
GET /api/v1/objects/{objectId}?space={spaceId}
```

**Parameters:**
- `objectId` (path): Object ID from create/query
- `space` (query): Space ID

**Response:**
```json
{
  "id": "obj-abc123xyz",
  "space": "bafyrei...",
  "name": "My Page Title",
  "type": "page",
  "created": "2026-02-28T10:00:00Z",
  "modified": "2026-02-28T10:00:00Z",
  "content": "# Markdown content here\n\nSupports markdown formatting.",
  "tags": ["openclaw", "session"],
  "properties": {
    "category": "notes"
  }
}
```

---

#### List/Query Objects

Search and list objects in a space.

```
GET /api/v1/objects?space={spaceId}&q={query}&tags={tag}&limit={limit}&offset={offset}
```

**Parameters:**
- `space` (required): Space ID
- `q` (optional): Search query (full-text search)
- `tags` (optional): Filter by tag(s) — can be repeated: `&tags=tag1&tags=tag2`
- `limit` (optional): Max results (default: 50, max: 1000)
- `offset` (optional): Pagination offset (default: 0)
- `type` (optional): Filter by object type

**Examples:**
```bash
# Get first 10 pages
curl -H "Authorization: Bearer KEY" \
  "http://127.0.0.1:31012/api/v1/objects?space=bafyrei...&limit=10"

# Search for "openclaw" pages
curl -H "Authorization: Bearer KEY" \
  "http://127.0.0.1:31012/api/v1/objects?space=bafyrei...&q=openclaw"

# Filter by tags
curl -H "Authorization: Bearer KEY" \
  "http://127.0.0.1:31012/api/v1/objects?space=bafyrei...&tags=openclaw&tags=session"
```

**Response:**
```json
{
  "objects": [
    {
      "id": "obj-abc123",
      "space": "bafyrei...",
      "name": "Session - 2026-02-28",
      "type": "page",
      "created": "2026-02-28T10:00:00Z",
      "modified": "2026-02-28T10:00:00Z",
      "content": "...",
      "tags": ["openclaw", "session"]
    }
  ],
  "total": 42,
  "limit": 10,
  "offset": 0
}
```

---

#### Update Object

Update content or metadata of an existing object.

```
PATCH /api/v1/objects/{objectId}
```

**Request Body:**
```json
{
  "space": "bafyrei...",
  "id": "obj-abc123xyz",
  "name": "Updated Title",
  "content": "Updated markdown content...",
  "tags": ["openclaw", "updated"],
  "properties": {
    "status": "completed"
  }
}
```

**Parameters:**
- `space` (required in body): Space ID
- `id` (required in body): Object ID
- `name` (optional): New title
- `content` (optional): New content
- `tags` (optional): Replace all tags
- `properties` (optional): Update custom properties

**Response:**
```json
{
  "id": "obj-abc123xyz",
  "space": "bafyrei...",
  "name": "Updated Title",
  "modified": "2026-02-28T11:00:00Z",
  "content": "Updated markdown content...",
  "tags": ["openclaw", "updated"]
}
```

---

#### Delete Object

Remove an object from the space.

```
DELETE /api/v1/objects/{objectId}?space={spaceId}
```

**Parameters:**
- `objectId` (path): Object ID
- `space` (query): Space ID

**Response:**
```json
{
  "success": true,
  "id": "obj-abc123xyz"
}
```

---

### Tags

#### Add Tags

Add tags to an existing object.

```
POST /api/v1/objects/{objectId}/tags
```

**Request Body:**
```json
{
  "space": "bafyrei...",
  "tags": ["newtag", "another-tag"]
}
```

**Parameters:**
- `space` (required): Space ID
- `tags` (required): Array of tags to add

**Response:**
```json
{
  "id": "obj-abc123xyz",
  "tags": ["openclaw", "session", "newtag", "another-tag"]
}
```

---

#### Remove Tags

Remove tags from an object.

```
DELETE /api/v1/objects/{objectId}/tags
```

**Request Body:**
```json
{
  "space": "bafyrei...",
  "tags": ["newtag"]
}
```

**Response:**
```json
{
  "id": "obj-abc123xyz",
  "tags": ["openclaw", "session"]
}
```

---

#### List Tags

List all tags in a space.

```
GET /api/v1/spaces/{spaceId}/tags
```

**Parameters:**
- `spaceId` (path): Space ID

**Response:**
```json
{
  "tags": [
    {
      "name": "openclaw",
      "count": 42
    },
    {
      "name": "session",
      "count": 40
    },
    {
      "name": "backup",
      "count": 38
    }
  ]
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "error-code",
  "message": "Human-readable error message",
  "status": 400
}
```

### Common Status Codes

- `200`: Success
- `201`: Created
- `204`: No Content
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (invalid API key)
- `403`: Forbidden (no permission to access space)
- `404`: Not Found (object/space doesn't exist)
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

### Error Examples

**Invalid API Key:**
```json
{
  "error": "unauthorized",
  "message": "Invalid or expired API key",
  "status": 401
}
```

**Space Not Found:**
```json
{
  "error": "not_found",
  "message": "Space 'bafyrei...' not found",
  "status": 404
}
```

**Rate Limited:**
```json
{
  "error": "rate_limited",
  "message": "Too many requests. Try again in 60 seconds.",
  "status": 429
}
```

---

## Rate Limiting

- **Default:** 100 requests per minute per API key
- **Burst:** Up to 20 requests in 10 seconds
- **Headers returned:**
  - `X-RateLimit-Limit`: Max requests per window
  - `X-RateLimit-Remaining`: Requests left in window
  - `X-RateLimit-Reset`: Unix timestamp when window resets

---

## Pagination

List endpoints support pagination via `limit` and `offset`:

```bash
# Get items 0-49
curl "...?limit=50&offset=0"

# Get items 50-99
curl "...?limit=50&offset=50"

# Get items 100-149
curl "...?limit=50&offset=100"
```

Max `limit` is 1000. Default is 50.

---

## Content Format

### Markdown Support

Content field supports full GitHub-flavored Markdown:

```markdown
# Heading 1
## Heading 2

**Bold** and *italic* text

- Bullet list
- Item 2

1. Numbered list
2. Item 2

`inline code` and:
\`\`\`javascript
// Code blocks
const x = 1;
\`\`\`

[Links](https://example.com)

| Table | Header |
|-------|--------|
| Data  | Cell   |
```

---

## Custom Properties

Objects can have custom properties (key-value pairs):

```json
{
  "properties": {
    "category": "notes",
    "priority": "high",
    "assignee": "user@example.com",
    "status": "in-progress",
    "estimatedHours": 8
  }
}
```

Properties are searchable and filterable via API.

---

## Timestamps

All timestamps are ISO 8601 format with UTC timezone:

```
2026-02-28T10:00:00Z
```

---

## Examples Using curl

### Create a Page

```bash
curl -X POST http://127.0.0.1:31012/api/v1/objects \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "space": "bafyrei...",
    "name": "My First Page",
    "content": "# Hello\n\nThis is a test page.",
    "tags": ["test"]
  }'
```

### Query Pages

```bash
curl http://127.0.0.1:31012/api/v1/objects \
  -H "Authorization: Bearer YOUR_API_KEY" \
  "?space=bafyrei...&q=openclaw&limit=10"
```

### Update a Page

```bash
curl -X PATCH http://127.0.0.1:31012/api/v1/objects/obj-abc123 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "space": "bafyrei...",
    "id": "obj-abc123",
    "content": "# Updated\n\nNew content here."
  }'
```

---

## SDK Usage

Use the included `anytype-api.js` for JavaScript:

```javascript
const { createClient } = require('anytype-api.js');

const client = createClient({
  apiUrl: 'http://127.0.0.1:31012',
  apiKey: 'your-api-key'
});

// Create
await client.createPage({
  spaceId: 'bafyrei...',
  title: 'My Page',
  content: '# Content'
});

// Query
const results = await client.queryPages({
  spaceId: 'bafyrei...',
  query: 'openclaw'
});

// Update
await client.updatePage({
  spaceId: 'bafyrei...',
  pageId: 'obj-abc123',
  content: 'Updated content'
});
```

---

## Best Practices

1. **Cache API key** in environment variables, not code
2. **Use specific queries** with tags and search terms to reduce data transfer
3. **Batch operations** — combine multiple updates into single requests when possible
4. **Handle rate limits** — implement exponential backoff for retries
5. **Pagination** — don't fetch all pages at once, use limit/offset
6. **Error handling** — check status codes and error messages
7. **Security** — never log API keys, store in secure vaults
8. **Monitoring** — track API response times and error rates

---

## Changelog

### 2026-02-28 (Current)
- Initial HTTP API release
- Support for spaces, objects, tags
- Full markdown content support
- Tagging system
- Query/search functionality

For latest updates, see https://developers.anytype.io/
