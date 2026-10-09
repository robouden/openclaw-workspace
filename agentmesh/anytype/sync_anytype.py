#!/usr/bin/env python3
"""One-way sync: AgentMesh Postgres -> Anytype pages (upsert by table:id)."""
import hashlib, json, os, subprocess, sys, time, urllib.error, urllib.request

D = os.path.expanduser("~/.local/share/agentmesh")
API = "http://127.0.0.1:31009/v1"
MAP = f"{D}/anytype_map.json"
# page name -> (sql, columns for table layout or None for sections)
PAGES = {
    "People": ("select * from people order by category, name",
               ["name", "kanji", "category", "role", "org", "phone", "email", "last_date", "last_note"]),
    "Outreach": ("select * from outreach order by sent_date desc nulls last",
                 ["sent_date", "contact", "channel", "subject", "status", "due_date", "note"]),
    "Tasks": ("select id, title, status, claimed_by, created_by, created_at::date as created from tasks order by id",
              ["id", "title", "status", "claimed_by", "created_by", "created"]),
    "Village Models": ("select * from village_models order by village",
                       ["village", "prefecture", "population", "forest_share", "owner_pooling", "village_role",
                        "coop_role", "private_operators", "machinery", "wood_use", "funding",
                        "relevance_to_mitsue", "confidence", "source", "notes"]),
    "CHP Equipment": ("select * from chp_equipment order by domestic_maker desc, maker",
                      ["maker", "model", "country", "kwe", "elec_efficiency", "fuel_type", "japan_installs", "domestic_maker", "website"]),
    "Chats": None,
}
CHAT_LIMIT, CHAT_CHARS = 20, 300


def env(path):
    out = {}
    for line in open(path):
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1)
            out[k] = v.strip('"')
    return out


pg, at = env(f"{D}/agentmesh.env"), env(f"{D}/anytype.env")
SPACE = at["ANYTYPE_SPACE_ID"]


def rows(sql):
    r = subprocess.run(
        ["psql", "-h", "127.0.0.1", "-p", "5433", "-U", "agentmesh", "agentmesh", "-Atc",
         f"select coalesce(json_agg(t),'[]') from ({sql}) t"],
        env={**os.environ, "PGPASSWORD": pg["AGENTMESH_PASSWORD"]},
        capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def call(method, path, body=None):
    req = urllib.request.Request(
        f"{API}/spaces/{SPACE}{path}", method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {at['ANYTYPE_API_KEY']}",
                 "Anytype-Version": "2025-11-08", "Content-Type": "application/json"})
    for wait in (2, 5, 10, 30, 60):
        try:
            r = json.load(urllib.request.urlopen(req, timeout=20))
            time.sleep(0.5)
            return r
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(wait)
    raise RuntimeError("Anytype rate limit: giving up; re-run to resume")


def cell(v):
    return str(v if v is not None else "").replace("|", "/").replace("\n", " ")[:200]


def table_md(data, cols):
    out = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    out += ["| " + " | ".join(cell(r.get(c)) for c in cols) + " |" for r in data]
    return "\n".join(out)


def sections_md(data):
    return "\n\n".join(
        "## " + str(next(iter(r.values()), "")) + "\n\n" +
        "\n\n".join(f"**{k}**: {v}" for k, v in list(r.items())[1:] if v not in (None, ""))
        for r in data)


def chats_md():
    out = []
    for t in rows("select id, slug, title from threads order by slug"):
        msgs = rows(f"select agent, role, content, created_at::timestamp(0) as at from messages "
                    f"where thread_id='{t['id']}' order by created_at desc limit {CHAT_LIMIT}")
        out.append(f"## {t['slug']}\n\n_latest {len(msgs)} messages_\n")
        for m in reversed(msgs):
            c = (m["content"] or "").replace("\n", " ")[:CHAT_CHARS]
            out.append(f"- **{m['agent']}** ({m['at']}): {c}")
        out.append("")
    return "\n".join(out)


def main():
    state = json.load(open(MAP)) if os.path.exists(MAP) else {}
    # one-time cleanup of the old one-page-per-row objects
    for k in [k for k in state if not k.startswith("page:")]:
        try:
            call("DELETE", f"/objects/{state[k]['oid']}")
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
        del state[k]
        json.dump(state, open(MAP, "w"))
    stamp = time.strftime("%Y-%m-%d %H:%M")
    for name, spec in PAGES.items():
        if spec is None:
            body = chats_md()
        else:
            data = rows(spec[0])
            body = table_md(data, spec[1]) if spec[1] else sections_md(data)
        body += "\n\n_Read-only copy from AgentMesh. Edit there._"
        h = hashlib.sha1(body.encode()).hexdigest()
        key, title = f"page:{name}", f"AgentMesh – {name}"
        ent = state.get(key)
        if ent and ent["hash"] == h:
            continue
        if ent:
            call("PATCH", f"/objects/{ent['oid']}", {"name": title, "markdown": body + f"\n_Synced {stamp}_"})
        else:
            o = call("POST", "/objects", {"type_key": "page", "name": title, "body": body})
            ent = {"oid": o["object"]["id"]}
        ent["hash"] = h
        state[key] = ent
        json.dump(state, open(MAP, "w"))
        print("synced", name)


if __name__ == "__main__":
    main()
