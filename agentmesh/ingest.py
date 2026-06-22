#!/usr/bin/env -S uv run --quiet
# /// script
# requires-python = ">=3.10"
# dependencies = ["psycopg[binary]>=3.2"]
# ///
"""agentmesh ingester — auto-share every agent's chat into the shared DB.

Tails the JSONL session transcripts of Claude, Qwen, OpenClaw and Kimi, extracts
conversational turns (user/assistant text only — NOT tool calls/results, where API
keys live), and writes new turns into agentmesh, one `firehose-<agent>` thread each.

Idempotent: a per-file byte cursor in table `ingest_cursors` means no line is ever
posted twice. Pre-existing files are started at EOF (no historical backfill); files
created after startup are captured from the beginning. Poll-based, ~3s.

Hermes is intentionally excluded: it stores full per-request API dumps, not an
incremental transcript — use deliberate `post` from Hermes instead.
"""
import os
import glob
import json
import time
import sqlite3

import psycopg

DSN = os.environ["AGENTMESH_DSN"]
POLL_SECONDS = float(os.environ.get("AGENTMESH_POLL", "3"))

# agent name -> glob of its appended JSONL transcripts
SOURCES = {
    "claude":   "/home/rob/.claude/projects/*/*.jsonl",
    "qwen":     "/home/rob/.qwen/projects/*/chats/*.jsonl",
    "openclaw": "/home/rob/.openclaw/workspace/sessions/*.jsonl",
    "kimi":     "/home/rob/.kimi/sessions/*/*/context.jsonl",
}

# Hermes has no tailable JSONL; it persists every turn (Desktop/CLI/gateway alike)
# into this SQLite DB. We tail it by autoincrement row id instead.
HERMES_DB = "/home/rob/.hermes/state.db"
HERMES_CURSOR = "hermes:state.db"

START = time.time()
_thread_cache: dict[str, str] = {}


def extract(d: dict):
    """Return (role, text) for a transcript line, or None to skip.

    Skips tool calls/results, thinking, errors, system markers — anything without
    plain user/assistant text. Handles content as str, [{type:text,text}] blocks,
    or {parts:[{text}]} (Qwen)."""
    m = d.get("message", d)            # claude/qwen/openclaw nest; kimi is flat
    role = m.get("role") or (d.get("type") if d.get("type") in ("user", "assistant") else None)
    if role not in ("user", "assistant"):
        return None
    content = m.get("content")
    parts = m.get("parts")
    text = ""
    if isinstance(content, str):
        text = content
    elif isinstance(content, list):
        text = "\n".join(
            b["text"] for b in content
            if isinstance(b, dict) and b.get("type", "text") == "text" and b.get("text"))
    elif isinstance(parts, list):
        text = "\n".join(p["text"] for p in parts if isinstance(p, dict) and p.get("text"))
    text = text.strip()
    model = m.get("model") or m.get("provider_model")
    return (role, text, model) if text else None


def thread_for(conn, agent: str) -> str:
    if agent in _thread_cache:
        return _thread_cache[agent]
    slug = f"firehose-{agent}"
    row = conn.execute(
        """INSERT INTO threads (slug, title, created_by) VALUES (%s, %s, %s)
           ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id""",
        (slug, f"Auto-shared chat: {agent}", None)).fetchone()
    _thread_cache[agent] = row[0]
    return row[0]


def ensure_schema(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS ingest_cursors (
        path text PRIMARY KEY, inode bigint, byte_offset bigint NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now())""")
    for agent in list(SOURCES) + ["hermes"]:
        conn.execute("INSERT INTO agents (name, kind) VALUES (%s,'harness') "
                     "ON CONFLICT (name) DO NOTHING", (agent,))


def process_file(conn, agent: str, path: str):
    try:
        st = os.stat(path)
    except FileNotFoundError:
        return
    row = conn.execute(
        "SELECT inode, byte_offset FROM ingest_cursors WHERE path=%s", (path,)).fetchone()
    if row is None:
        # first sighting: skip backlog for pre-existing files, capture new ones whole
        start = st.st_size if st.st_mtime < START else 0
        conn.execute("INSERT INTO ingest_cursors (path, inode, byte_offset) VALUES (%s,%s,%s)",
                     (path, st.st_ino, start))
        offset = start
    else:
        inode, offset = row
        if st.st_ino != inode or st.st_size < offset:   # rotated/truncated -> restart
            offset = 0
            conn.execute("UPDATE ingest_cursors SET inode=%s WHERE path=%s", (st.st_ino, path))
    if st.st_size <= offset:
        return

    with open(path, "rb") as f:
        f.seek(offset)
        chunk = f.read()
    end = chunk.rfind(b"\n") + 1          # only consume complete lines
    if end <= 0:
        return
    sid = os.path.basename(path).split(".")[0]
    posted = 0
    for raw in chunk[:end].split(b"\n"):
        if not raw.strip():
            continue
        try:
            d = json.loads(raw)
        except Exception:
            continue
        ext = extract(d)
        if not ext:
            continue
        role, text, model = ext
        meta = {"source": "ingest", "session": sid, "file": path}
        if model:
            meta["model"] = model
        conn.execute(
            """INSERT INTO messages (thread_id, agent, role, content, metadata)
               VALUES (%s,%s,%s,%s,%s)""",
            (thread_for(conn, agent), agent, role, text, json.dumps(meta)))
        posted += 1
    conn.execute("UPDATE ingest_cursors SET byte_offset=%s, updated_at=now() WHERE path=%s",
                 (offset + end, path))
    if posted:
        print(f"[{agent}] +{posted} turns from {sid}", flush=True)


def ingest_hermes(conn):
    """Tail ~/.hermes/state.db messages by row id → firehose-hermes (all run modes)."""
    if not os.path.exists(HERMES_DB):
        return
    row = conn.execute(
        "SELECT byte_offset FROM ingest_cursors WHERE path=%s", (HERMES_CURSOR,)).fetchone()
    sq = sqlite3.connect(f"file:{HERMES_DB}?mode=ro", uri=True, timeout=5)
    try:
        if row is None:                       # first run: skip backlog, start at newest id
            last = sq.execute("SELECT COALESCE(MAX(id),0) FROM messages").fetchone()[0]
            conn.execute("INSERT INTO ingest_cursors (path, byte_offset) VALUES (%s,%s)",
                         (HERMES_CURSOR, last))
            return
        last = row[0]
        rows = sq.execute(
            """SELECT m.id, m.role, m.content, m.session_id,
                      s.model, s.billing_provider
               FROM messages m LEFT JOIN sessions s ON s.id = m.session_id
               WHERE m.id > ? AND m.active=1 AND m.role IN ('user','assistant')
                     AND m.content IS NOT NULL AND trim(m.content) <> ''
               ORDER BY m.id""", (last,)).fetchall()
    finally:
        sq.close()
    posted = 0
    for mid, role, content, sid, sess_model, billing_provider in rows:
        meta = {"source": "ingest", "session": sid, "db_id": mid}
        model_label = None
        if sess_model:
            model_label = f"{billing_provider}/{sess_model}" if billing_provider else sess_model
        if model_label:
            meta["model"] = model_label
        conn.execute(
            """INSERT INTO messages (thread_id, agent, role, content, metadata)
               VALUES (%s,'hermes',%s,%s,%s)""",
            (thread_for(conn, "hermes"), role, content.strip(), json.dumps(meta)))
        last = max(last, mid)
        posted += 1
    if posted:
        conn.execute("UPDATE ingest_cursors SET byte_offset=%s, updated_at=now() WHERE path=%s",
                     (last, HERMES_CURSOR))
        print(f"[hermes] +{posted} turns from state.db", flush=True)


# OpenCode stores sessions in SQLite. We tail all three DBs (dev, stable, main)
# by message row id. Model name comes from the assistant message's data JSON.
OPENCODE_DBS = {
    "opencode-dev":  "/home/rob/.local/share/opencode/opencode-dev.db",
    "opencode":      "/home/rob/.local/share/opencode/opencode.db",
    "opencode-main": "/home/rob/.local/share/opencode/opencode-main.db",
}


def ingest_opencode_db(conn, agent: str, db_path: str):
    """Tail one OpenCode SQLite DB by message row id → firehose-<agent>."""
    if not os.path.exists(db_path):
        return
    cursor_key = f"opencode:{db_path}"
    row = conn.execute(
        "SELECT byte_offset FROM ingest_cursors WHERE path=%s", (cursor_key,)).fetchone()
    sq = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=5)
    try:
        # Use rowid as our incrementing cursor
        if row is None:
            last = sq.execute("SELECT COALESCE(MAX(rowid),0) FROM message").fetchone()[0]
            conn.execute("INSERT INTO ingest_cursors (path, byte_offset) VALUES (%s,%s)",
                         (cursor_key, last))
            return
        last = row[0]
        rows = sq.execute("""
            SELECT m.rowid,
                   json_extract(m.data,'$.role')       AS role,
                   json_extract(m.data,'$.modelID')    AS model_id,
                   json_extract(m.data,'$.providerID') AS provider_id,
                   coalesce(pt.txt, pr.txt)            AS txt,
                   s.title
            FROM message m
            JOIN session s ON s.id = m.session_id
            LEFT JOIN (
                SELECT message_id, group_concat(json_extract(data,'$.text'),' ') AS txt
                FROM part WHERE json_extract(data,'$.type') = 'text'
                GROUP BY message_id
            ) pt ON pt.message_id = m.id
            LEFT JOIN (
                SELECT message_id, group_concat(json_extract(data,'$.text'),' ') AS txt
                FROM part WHERE json_extract(data,'$.type') = 'reasoning'
                GROUP BY message_id
            ) pr ON pr.message_id = m.id
            WHERE m.rowid > ?
              AND json_extract(m.data,'$.role') IN ('user','assistant')
            ORDER BY m.rowid
        """, (last,)).fetchall()
    finally:
        sq.close()

    posted = 0
    for rowid, role, model_id, provider_id, text, session_title in rows:
        text = (text or "").strip()
        if not text:
            last = max(last, rowid)
            continue
        model_label = f"{provider_id}/{model_id}" if model_id else None
        meta = {"source": "ingest", "session": session_title or ""}
        if model_label:
            meta["model"] = model_label
        conn.execute(
            """INSERT INTO messages (thread_id, agent, role, content, metadata)
               VALUES (%s,%s,%s,%s,%s)""",
            (thread_for(conn, agent), agent, role, text,
             json.dumps(meta)))
        last = max(last, rowid)
        posted += 1

    if posted:
        conn.execute("UPDATE ingest_cursors SET byte_offset=%s, updated_at=now() WHERE path=%s",
                     (last, cursor_key))
        print(f"[{agent}] +{posted} turns from {os.path.basename(db_path)}", flush=True)


def main():
    with psycopg.connect(DSN, autocommit=True) as conn:
        ensure_schema(conn)
        print(f"agentmesh ingester up; watching {len(SOURCES)} JSONL sources + Hermes + OpenCode DBs", flush=True)
        while True:
            for agent, pattern in SOURCES.items():
                for path in glob.glob(pattern):
                    try:
                        process_file(conn, agent, path)
                    except Exception as e:
                        print(f"[{agent}] error on {path}: {e}", flush=True)
            try:
                ingest_hermes(conn)
            except Exception as e:
                print(f"[hermes] error on state.db: {e}", flush=True)
            for agent, db_path in OPENCODE_DBS.items():
                try:
                    ingest_opencode_db(conn, agent, db_path)
                except Exception as e:
                    print(f"[{agent}] error on {db_path}: {e}", flush=True)
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
