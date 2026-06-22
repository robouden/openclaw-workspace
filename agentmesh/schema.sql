-- agentmesh: shared collaboration store for OpenClaw, Hermes, Qwen, Kimi, Claude
-- Applied to database "agentmesh". Minimal, jsonb-flexible.

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- Participants in the mesh (one row per agent identity).
CREATE TABLE IF NOT EXISTS agents (
    name        text PRIMARY KEY,                 -- e.g. claude, openclaw, hermes, qwen, kimi
    kind        text,                             -- harness / model / human
    metadata    jsonb NOT NULL DEFAULT '{}',
    first_seen  timestamptz NOT NULL DEFAULT now(),
    last_seen   timestamptz NOT NULL DEFAULT now()
);

-- Shared collaboration channels (NOT a mirror of any tool's internal sessions).
CREATE TABLE IF NOT EXISTS threads (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        text UNIQUE,                       -- human handle, e.g. "main"
    title       text,
    metadata    jsonb NOT NULL DEFAULT '{}',
    created_by  text REFERENCES agents(name),
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Append-only shared transcript: chat, results, history.
CREATE TABLE IF NOT EXISTS messages (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    thread_id   uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    agent       text NOT NULL REFERENCES agents(name),
    role        text NOT NULL DEFAULT 'assistant', -- assistant/user/system/result/tool
    content     text NOT NULL,
    metadata    jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_thread_id_idx ON messages (thread_id, id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at);

-- Namespaced shared memory (key/value, last-write-wins).
CREATE TABLE IF NOT EXISTS memory (
    namespace   text NOT NULL,
    key         text NOT NULL,
    value       jsonb NOT NULL,
    updated_by  text REFERENCES agents(name),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (namespace, key)
);

-- Coordination queue: agents claim work via FOR UPDATE SKIP LOCKED.
CREATE TABLE IF NOT EXISTS tasks (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    thread_id   uuid REFERENCES threads(id) ON DELETE SET NULL,
    title       text NOT NULL,
    payload     jsonb NOT NULL DEFAULT '{}',
    status      text NOT NULL DEFAULT 'open',      -- open/claimed/done/failed
    created_by  text REFERENCES agents(name),
    claimed_by  text REFERENCES agents(name),
    result      jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks (status, id);

-- Seed a default shared thread.
INSERT INTO threads (slug, title) VALUES ('main', 'Shared agent channel')
    ON CONFLICT (slug) DO NOTHING;

-- ── Browsing views (DBeaver-friendly) ──────────────────────────────────────
CREATE OR REPLACE VIEW v_chat AS
SELECT m.id, m.created_at, m.agent, m.role, t.slug AS thread, t.title AS thread_title,
       (m.metadata->>'source') AS source, (m.metadata->>'session') AS session, m.content
FROM messages m JOIN threads t ON t.id = m.thread_id;

CREATE OR REPLACE VIEW v_firehose AS
SELECT id, created_at, agent, role, content, (metadata->>'session') AS session
FROM messages WHERE metadata->>'source' = 'ingest' ORDER BY id DESC;

CREATE OR REPLACE VIEW v_posts AS
SELECT m.id, m.created_at, m.agent, m.role, t.slug AS thread, m.content
FROM messages m JOIN threads t ON t.id = m.thread_id
WHERE coalesce(m.metadata->>'source','') <> 'ingest' ORDER BY m.id DESC;

CREATE OR REPLACE VIEW v_activity AS
SELECT a.name AS agent, a.last_seen, count(m.id) AS total_messages,
       count(*) FILTER (WHERE m.metadata->>'source'='ingest') AS auto_captured,
       max(m.created_at) AS last_message
FROM agents a LEFT JOIN messages m ON m.agent = a.name
GROUP BY a.name, a.last_seen ORDER BY last_message DESC NULLS LAST;

CREATE OR REPLACE VIEW v_tasks AS
SELECT id, status, created_by, claimed_by, title, created_at, updated_at, result, payload
FROM tasks ORDER BY id DESC;
