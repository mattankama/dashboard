-- Dashboard schema, Phase 1. See spec/SPEC-web.md ("Data model").

CREATE TABLE items (
  id          TEXT PRIMARY KEY,              -- crypto.randomUUID()
  text        TEXT NOT NULL,                 -- exactly as written (trimmed only)
  category    TEXT,                          -- null = uncategorized
  pinned      INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created_at  TEXT NOT NULL,                 -- ISO 8601 UTC
  updated_at  TEXT NOT NULL,
  archived_at TEXT                           -- null = active
);
CREATE INDEX items_archived_at ON items (archived_at);

CREATE TABLE print_runs (
  id          TEXT PRIMARY KEY,
  week        TEXT NOT NULL,                 -- ISO week, e.g. 2026-W41
  printed_at  TEXT,
  emailed_at  TEXT,
  status      TEXT NOT NULL CHECK (status IN ('printed', 'emailed_only', 'failed')),
  created_at  TEXT NOT NULL
);
