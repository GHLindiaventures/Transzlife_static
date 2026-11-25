-- System health & error monitoring tables (Settings -> System health).
-- Kept compact: health_checks pruned to 30 days, error_log (no personal data) pruned to 14 days.

CREATE TABLE IF NOT EXISTS health_checks (
  id          bigserial PRIMARY KEY,
  group_key   text NOT NULL,
  check_key   text NOT NULL,
  label       text NOT NULL,
  status      text NOT NULL CHECK (status IN ('ok', 'warn', 'error')),
  summary     text NOT NULL DEFAULT '',
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer NOT NULL DEFAULT 0,
  checked_at  timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX IF NOT EXISTS health_checks_key_time_idx ON health_checks (check_key, checked_at DESC)
-- ;;
CREATE INDEX IF NOT EXISTS health_checks_time_idx ON health_checks (checked_at DESC)
-- ;;
CREATE TABLE IF NOT EXISTS health_incidents (
  id          bigserial PRIMARY KEY,
  check_key   text NOT NULL,
  label       text NOT NULL,
  status      text NOT NULL CHECK (status IN ('warn', 'error')),
  summary     text NOT NULL DEFAULT '',
  started_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  notified_at timestamptz
)
-- ;;
CREATE INDEX IF NOT EXISTS health_incidents_open_idx ON health_incidents (resolved_at, started_at DESC)
-- ;;
CREATE TABLE IF NOT EXISTS error_log (
  id          bigserial PRIMARY KEY,
  method      text NOT NULL,
  route       text NOT NULL,
  status_code integer NOT NULL,
  message     text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX IF NOT EXISTS error_log_time_idx ON error_log (created_at DESC)
-- ;;
CREATE TABLE IF NOT EXISTS job_heartbeats (
  job_key          text PRIMARY KEY,
  label            text NOT NULL,
  interval_minutes integer NOT NULL DEFAULT 5,
  last_run_at      timestamptz NOT NULL DEFAULT now(),
  last_status      text NOT NULL DEFAULT 'ok',
  last_error       text NOT NULL DEFAULT '',
  duration_ms      integer NOT NULL DEFAULT 0
)
