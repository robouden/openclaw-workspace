# OpenClaw + MongoDB + AnyType System Flow

This document illustrates the complete data flow between OpenClaw, MongoDB, and AnyType workspace sync.

## System Architecture Diagram

```mermaid
graph TB
    subgraph "OpenClaw Bot"
        OC[OpenClaw Process]
        OCLogic[Bot Logic]
    end

    subgraph "MongoDB Database"
        DB[(MongoDB)]
        Notes[notes collection]
        Tasks[tasks collection]
        Events[events collection]
    end

    subgraph "VPS File System"
        WS[/root/anytype-workspace/]
        MD1[note1.md]
        MD2[note2.md]
        MD3[task.md]
        ObjMap[.anytype-workspace-objectmap.json]
    end

    subgraph "Workspace Sync Service"
        WSSync[anytype-workspace-sync-bin]
        FSNotify[fsnotify Watcher]
        ObjTracker[Object Map Manager]
        GRPCClient[gRPC Client]
    end

    subgraph "AnyType Local Server"
        ATServe[anytype serve -q]
        GRPCServer[gRPC Server :31010]
        AuthMgr[Session Token Auth]
        ConfigFile[~/.anytype/config.json]
    end

    subgraph "AnyType Self-Hosted Network"
        Space[AnyType Space]
        Coordinator[Coordinator Node]
        Consensus[Consensus Node]
        FileNode[File Storage Node]
    end

    %% OpenClaw to MongoDB
    OC -->|1. Store bot data| DB
    OCLogic -->|2. Query/Update| Notes
    OCLogic -->|3. Query/Update| Tasks
    OCLogic -->|4. Log events| Events

    %% MongoDB to OpenClaw
    DB -->|5. Change streams| OC
    Notes -->|6. Read data| OCLogic

    %% OpenClaw to Workspace
    OC -->|7. Write .md files| WS
    OCLogic -->|8. Create note1.md| MD1
    OCLogic -->|9. Create note2.md| MD2
    OCLogic -->|10. Create task.md| MD3

    %% Workspace to Sync Service
    WS -->|11. Watch directory| FSNotify
    MD1 -->|12. CREATE event| FSNotify
    MD2 -->|13. WRITE event| FSNotify
    MD3 -->|14. REMOVE event| FSNotify

    %% Sync Service Processing
    FSNotify -->|15. Notify change| WSSync
    WSSync -->|16. Parse markdown| WSSync
    WSSync -->|17. Track object IDs| ObjTracker
    ObjTracker -->|18. Store mapping| ObjMap
    ObjMap -->|19. Retrieve object ID| ObjTracker

    %% Sync Service to gRPC
    WSSync -->|20. Send RPC request| GRPCClient
    GRPCClient -->|21. ObjectCreate/Delete| GRPCServer

    %% Authentication Flow
    GRPCClient -->|22. Read session token| ConfigFile
    ConfigFile -->|23. Return token| GRPCClient
    GRPCClient -->|24. Add auth metadata| GRPCClient
    GRPCServer -->|25. Validate token| AuthMgr
    AuthMgr -->|26. Check session| ATServe

    %% AnyType Server to Space
    ATServe -->|27. Sync objects| Space
    Space -->|28. Replicate| Coordinator
    Coordinator -->|29. Consensus| Consensus
    Space -->|30. Store files| FileNode

    %% Reverse flow (from Space to OpenClaw)
    Space -.->|31. Future: bidirectional sync| ATServe
    ATServe -.->|32. Future: notify changes| WSSync
    WSSync -.->|33. Future: write files| WS
    WS -.->|34. Future: trigger update| OC

    style OC fill:#e1f5ff
    style DB fill:#ffe1e1
    style WSSync fill:#e1ffe1
    style ATServe fill:#fff4e1
    style Space fill:#f0e1ff
    style ObjMap fill:#ffe1f0
```

## Sequence Diagram: Create Flow

```mermaid
sequenceDiagram
    participant OC as OpenClaw Bot
    participant DB as MongoDB
    participant FS as File System
    participant WS as Workspace Sync
    participant AT as AnyType Server
    participant SP as AnyType Space

    Note over OC,SP: File Creation Flow

    OC->>DB: 1. Store note data
    DB-->>OC: Confirm stored

    OC->>FS: 2. Write /root/anytype-workspace/my-note.md

    FS->>WS: 3. fsnotify: CREATE event

    WS->>WS: 4. Parse markdown (extract title)
    WS->>WS: 5. Debounce (wait 2s)

    WS->>AT: 6. Read ~/.anytype/config.json
    AT-->>WS: 7. Return session token

    WS->>AT: 8. gRPC: ObjectCreate(title, content)
    Note over WS,AT: Auth: metadata["token"] = sessionToken

    AT->>AT: 9. Validate session token
    AT->>SP: 10. Create note object
    SP-->>AT: 11. Return object ID (bafyreig...)

    AT-->>WS: 12. Object created (ID: bafyreig...)

    WS->>FS: 13. Store mapping: {"my-note": "bafyreig..."}

    WS->>WS: 14. Log: ✓ my-note synced to AnyType

    Note over OC,SP: Note now exists in MongoDB, File System, and AnyType
```

## Sequence Diagram: Delete Flow

```mermaid
sequenceDiagram
    participant OC as OpenClaw Bot
    participant DB as MongoDB
    participant FS as File System
    participant WS as Workspace Sync
    participant MAP as Object Map
    participant AT as AnyType Server
    participant SP as AnyType Space

    Note over OC,SP: File Deletion Flow

    OC->>DB: 1. Mark note as deleted
    DB-->>OC: Confirmed

    OC->>FS: 2. Delete /root/anytype-workspace/my-note.md

    FS->>WS: 3. fsnotify: REMOVE event

    WS->>MAP: 4. Get object ID for "my-note"
    MAP-->>WS: 5. Return "bafyreig..."

    WS->>AT: 6. Read session token
    AT-->>WS: 7. Return token

    WS->>AT: 8. gRPC: ObjectListDelete([bafyreig...])
    Note over WS,AT: Auth: metadata["token"] = sessionToken

    AT->>AT: 9. Validate session token
    AT->>SP: 10. Delete object
    SP-->>AT: 11. Deletion confirmed

    AT-->>WS: 12. Object deleted

    WS->>MAP: 13. Remove mapping for "my-note"
    MAP-->>WS: 14. Mapping removed

    WS->>WS: 15. Log: ✓ my-note deleted from AnyType

    Note over OC,SP: Note removed from File System and AnyType (archived in MongoDB)
```

## Sequence Diagram: Update Flow

```mermaid
sequenceDiagram
    participant OC as OpenClaw Bot
    participant DB as MongoDB
    participant FS as File System
    participant WS as Workspace Sync
    participant MAP as Object Map
    participant AT as AnyType Server
    participant SP as AnyType Space

    Note over OC,SP: File Update Flow

    OC->>DB: 1. Update note content
    DB-->>OC: Confirmed

    OC->>FS: 2. Modify /root/anytype-workspace/my-note.md

    FS->>WS: 3. fsnotify: WRITE event

    WS->>WS: 4. Debounce (wait 2s for more changes)

    WS->>WS: 5. Parse updated markdown

    WS->>AT: 6. Read session token
    AT-->>WS: 7. Return token

    WS->>AT: 8. gRPC: ObjectCreate(title, new_content)
    Note over WS,AT: Creates new object (AnyType versioning)

    AT->>SP: 9. Create new version of object
    SP-->>AT: 10. Return new object ID

    AT-->>WS: 11. Object updated (new ID: bafyreih...)

    WS->>MAP: 12. Update mapping: {"my-note": "bafyreih..."}

    WS->>WS: 13. Log: ✓ my-note synced to AnyType

    Note over OC,SP: Note updated in all systems
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant CLI as anytype CLI
    participant CFG as ~/.anytype/config.json
    participant SRV as anytype serve
    participant WS as Workspace Sync
    participant GRPC as gRPC Server

    Note over CLI,GRPC: Initial Setup (one-time)

    CLI->>CLI: 1. anytype auth login --account-key
    CLI->>CFG: 2. Store account credentials
    CLI->>SRV: 3. anytype serve -q (background)
    SRV->>CFG: 4. Create session token (JWT)

    Note over CLI,GRPC: Runtime Authentication (every request)

    WS->>WS: 5. Start workspace-sync-bin
    WS->>CFG: 6. Read session token
    CFG-->>WS: 7. Return JWT token

    WS->>GRPC: 8. gRPC call + metadata["token"]
    GRPC->>GRPC: 9. Validate JWT signature
    GRPC->>GRPC: 10. Check token expiry

    alt Token Valid
        GRPC-->>WS: 11. Success + response
    else Token Expired
        GRPC-->>WS: 12. Error: not authenticated
        WS->>SRV: 13. Detect auth error
        WS->>SRV: 14. Trigger token refresh
        Note over WS,SRV: Future: automatic renewal
    end
```

## Data Flow Summary

### 1. OpenClaw → MongoDB (Primary Data Store)
- OpenClaw stores all bot state, notes, tasks in MongoDB
- Uses MongoDB change streams for real-time updates
- MongoDB is source of truth for bot logic

### 2. OpenClaw → File System (Export)
- OpenClaw writes markdown files to `/root/anytype-workspace/`
- Each note in MongoDB can generate a corresponding .md file
- File names are slug-ified note titles

### 3. File System → Workspace Sync (Watch)
- `fsnotify` watches directory for changes (CREATE, WRITE, REMOVE)
- 2-second debounce prevents duplicate syncs
- Tracks file modification timestamps

### 4. Workspace Sync → Object Map (Tracking)
- Maps filenames to AnyType object IDs
- Stored in `/root/.anytype-workspace-objectmap.json`
- Required for delete operations
- Thread-safe with mutex locks

### 5. Workspace Sync → AnyType Server (gRPC)
- Connects to `127.0.0.1:31010`
- Uses session token from `~/.anytype/config.json`
- RPC methods: `ObjectCreate`, `ObjectListDelete`, `WorkspaceOpen`

### 6. AnyType Server → Space (Sync)
- `anytype serve` maintains connection to self-hosted network
- Syncs objects to coordinator, consensus, and file nodes
- Handles network-level replication

## File Locations

| Component | Location | Purpose |
|-----------|----------|---------|
| OpenClaw Bot | `/path/to/openclaw/` | Bot application |
| MongoDB | `mongodb://localhost:27017` | Primary database |
| Workspace Dir | `/root/anytype-workspace/` | Markdown files |
| Sync Service | `/root/anytype-workspace-sync-bin` | File watcher |
| Object Map | `/root/.anytype-workspace-objectmap.json` | ID mappings |
| AnyType Config | `/root/.anytype/config.json` | Session token |
| AnyType Server | `/root/.local/bin/anytype` | CLI + server |
| Network Config | `/var/lib/anytype/data/client-config.yml` | Network nodes |

## Network Topology

```mermaid
graph LR
    subgraph "VPS Server"
        OC[OpenClaw]
        DB[(MongoDB)]
        WS[Workspace Sync]
        AT[AnyType Server]
    end

    subgraph "Self-Hosted AnyType Network"
        C[Coordinator Node]
        CN[Consensus Node]
        F[File Node]
    end

    subgraph "AnyType Clients"
        Desktop[AnyType Desktop App]
        Mobile[AnyType Mobile App]
    end

    OC <-->|Read/Write| DB
    OC -->|Write .md| WS
    WS -->|gRPC :31010| AT
    AT <-->|Network Sync| C
    C <-->|Consensus| CN
    C <-->|Store Files| F
    Desktop <-->|Sync| C
    Mobile <-->|Sync| C

    style VPS fill:#e1f5ff
    style "Self-Hosted AnyType Network" fill:#f0e1ff
    style "AnyType Clients" fill:#ffe1e1
```

## Performance Characteristics

- **File Change Detection**: < 1 second (fsnotify)
- **Debounce Time**: 2 seconds (prevents duplicate syncs)
- **gRPC Object Creation**: 100-300ms
- **Total Sync Latency**: ~2-5 seconds (file write → AnyType object)
- **MongoDB Query**: 10-50ms (local network)
- **Network Sync**: Varies (depends on network topology)

## Future Enhancements

1. **Bidirectional Sync** (dotted lines in diagram)
   - AnyType changes → File System
   - File System → MongoDB
   - MongoDB → OpenClaw notification

2. **Automatic Token Refresh**
   - Detect auth failures
   - Restart AnyType server
   - Reload token automatically

3. **Conflict Resolution**
   - Handle simultaneous edits
   - Last-write-wins vs merge strategies

4. **Webhook Notifications**
   - OpenClaw receives sync completion events
   - Real-time status updates

---

**Legend:**
- Solid lines (—): Current implementation
- Dotted lines (- -): Future/planned features
- Numbers: Sequential operation order
