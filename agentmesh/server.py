#!/usr/bin/env -S uv run --quiet
# /// script
# requires-python = ">=3.10"
# dependencies = ["fastmcp>=2", "psycopg[binary]>=3.2"]
# ///
"""agentmesh MCP server (stdio).

Shared collaboration store across OpenClaw, Hermes, Qwen, Kimi and Claude.
Identity is injected per-client via env AGENTMESH_AGENT; every write is stamped
with it. Connection via AGENTMESH_DSN (defaults to local PG18 on :5433).
"""
import os
import json
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from fastmcp import FastMCP

AGENT = os.environ.get("AGENTMESH_AGENT", "unknown")
AGENT_KIND = os.environ.get("AGENTMESH_AGENT_KIND", "harness")
DSN = os.environ.get(
    "AGENTMESH_DSN",
    "host=127.0.0.1 port=5433 dbname=agentmesh user=agentmesh"
    f" password={os.environ.get('AGENTMESH_PASSWORD', '')}",
)

mcp = FastMCP("agentmesh")


@contextmanager
def db():
    with psycopg.connect(DSN, row_factory=dict_row, autocommit=True) as conn:
        yield conn


def _register(conn):
    conn.execute(
        """INSERT INTO agents (name, kind) VALUES (%s, %s)
           ON CONFLICT (name) DO UPDATE SET last_seen = now()""",
        (AGENT, AGENT_KIND),
    )


def _thread_id(conn, thread):
    """Resolve a thread slug or uuid to its id; default 'main'."""
    thread = thread or "main"
    row = conn.execute(
        "SELECT id FROM threads WHERE slug = %s OR id::text = %s", (thread, thread)
    ).fetchone()
    if not row:
        raise ValueError(f"No such thread: {thread}")
    return row["id"]


@mcp.tool
def whoami() -> dict:
    """Return this client's agent identity and DB connection info."""
    with db() as conn:
        _register(conn)
    return {"agent": AGENT, "kind": AGENT_KIND, "dsn_host": DSN.split("password=")[0].strip()}


@mcp.tool
def post(content: str, thread: str = "main", role: str = "assistant",
         metadata: dict | None = None) -> dict:
    """Append a message (chat/result/note) to a shared thread."""
    with db() as conn:
        _register(conn)
        tid = _thread_id(conn, thread)
        row = conn.execute(
            """INSERT INTO messages (thread_id, agent, role, content, metadata)
               VALUES (%s, %s, %s, %s, %s) RETURNING id, created_at""",
            (tid, AGENT, role, content, json.dumps(metadata or {})),
        ).fetchone()
    return {"id": row["id"], "created_at": row["created_at"].isoformat(), "thread": thread}


@mcp.tool
def read_thread(thread: str = "main", limit: int = 50, since_id: int = 0) -> list[dict]:
    """Read recent messages in a thread (oldest->newest). Use since_id to poll for new ones."""
    with db() as conn:
        rows = conn.execute(
            """SELECT id, agent, role, content, metadata, created_at
               FROM messages WHERE thread_id = %s AND id > %s
               ORDER BY id DESC LIMIT %s""",
            (_thread_id(conn, thread), since_id, limit),
        ).fetchall()
    rows.reverse()
    return [{**r, "created_at": r["created_at"].isoformat()} for r in rows]


@mcp.tool
def list_threads() -> list[dict]:
    """List all shared threads with message counts."""
    with db() as conn:
        rows = conn.execute(
            """SELECT t.slug, t.title, t.id::text AS id, count(m.id) AS messages,
                      max(m.created_at) AS last_activity
               FROM threads t LEFT JOIN messages m ON m.thread_id = t.id
               GROUP BY t.id ORDER BY last_activity DESC NULLS LAST"""
        ).fetchall()
    return [{**r, "last_activity": r["last_activity"].isoformat() if r["last_activity"] else None}
            for r in rows]


@mcp.tool
def create_thread(slug: str, title: str = "") -> dict:
    """Create a new shared collaboration thread."""
    with db() as conn:
        _register(conn)
        row = conn.execute(
            """INSERT INTO threads (slug, title, created_by) VALUES (%s, %s, %s)
               ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
               RETURNING id::text, slug, title""",
            (slug, title, AGENT),
        ).fetchone()
    return row


@mcp.tool
def memory_set(namespace: str, key: str, value: dict) -> dict:
    """Store a value in shared namespaced memory (last write wins)."""
    with db() as conn:
        _register(conn)
        conn.execute(
            """INSERT INTO memory (namespace, key, value, updated_by)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (namespace, key)
               DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
                             updated_at = now()""",
            (namespace, key, json.dumps(value), AGENT),
        )
    return {"namespace": namespace, "key": key, "ok": True}


@mcp.tool
def memory_get(namespace: str, key: str = "") -> list[dict]:
    """Get a memory value, or all keys in a namespace if key is omitted."""
    with db() as conn:
        if key:
            rows = conn.execute(
                "SELECT namespace, key, value, updated_by, updated_at FROM memory WHERE namespace=%s AND key=%s",
                (namespace, key)).fetchall()
        else:
            rows = conn.execute(
                "SELECT namespace, key, value, updated_by, updated_at FROM memory WHERE namespace=%s ORDER BY key",
                (namespace,)).fetchall()
    return [{**r, "updated_at": r["updated_at"].isoformat()} for r in rows]


@mcp.tool
def task_create(title: str, payload: dict | None = None, thread: str = "main") -> dict:
    """Create a task on the shared queue for any agent to claim."""
    with db() as conn:
        _register(conn)
        row = conn.execute(
            """INSERT INTO tasks (thread_id, title, payload, created_by)
               VALUES (%s, %s, %s, %s) RETURNING id, status""",
            (_thread_id(conn, thread), title, json.dumps(payload or {}), AGENT),
        ).fetchone()
    return {"id": row["id"], "status": row["status"]}


@mcp.tool
def task_claim() -> dict | None:
    """Atomically claim the oldest open task (FOR UPDATE SKIP LOCKED). Returns None if none."""
    with psycopg.connect(DSN, row_factory=dict_row) as conn:  # explicit txn
        _register(conn)
        row = conn.execute(
            """SELECT id, title, payload FROM tasks WHERE status='open'
               ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1"""
        ).fetchone()
        if not row:
            conn.commit()
            return None
        conn.execute(
            "UPDATE tasks SET status='claimed', claimed_by=%s, updated_at=now() WHERE id=%s",
            (AGENT, row["id"]))
        conn.commit()
    return {"id": row["id"], "title": row["title"], "payload": row["payload"]}


@mcp.tool
def task_complete(task_id: int, result: dict | None = None, status: str = "done") -> dict:
    """Mark a task done/failed with an optional result payload."""
    with db() as conn:
        conn.execute(
            "UPDATE tasks SET status=%s, result=%s, updated_at=now() WHERE id=%s",
            (status, json.dumps(result or {}), task_id))
    return {"id": task_id, "status": status}


@mcp.tool
def list_tasks(status: str = "") -> list[dict]:
    """List tasks, optionally filtered by status (open/claimed/done/failed)."""
    with db() as conn:
        if status:
            rows = conn.execute(
                "SELECT id, title, status, created_by, claimed_by, updated_at FROM tasks WHERE status=%s ORDER BY id DESC LIMIT 100",
                (status,)).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, title, status, created_by, claimed_by, updated_at FROM tasks ORDER BY id DESC LIMIT 100").fetchall()
    return [{**r, "updated_at": r["updated_at"].isoformat()} for r in rows]


@mcp.tool
def list_agents() -> list[dict]:
    """List all agents that have connected to the mesh."""
    with db() as conn:
        rows = conn.execute(
            "SELECT name, kind, first_seen, last_seen FROM agents ORDER BY last_seen DESC").fetchall()
    return [{**r, "first_seen": r["first_seen"].isoformat(), "last_seen": r["last_seen"].isoformat()}
            for r in rows]


if __name__ == "__main__":
    mcp.run()
