CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- T07: 계정
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id text NOT NULL CHECK (length(trim(login_id)) BETWEEN 3 AND 50),
  password_hash text NOT NULL CHECK (length(password_hash) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- login_id의 대소문자만 바꿔 중복 가입하는 것도 막는다.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_id_lower
  ON users (lower(login_id));

-- =========================================================
-- T07: 서버 측 세션
-- 브라우저의 세션 ID 원문은 DB에 저장하지 않고 SHA-256 해시만 저장한다.
-- =========================================================

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user
  ON sessions(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_expires
  ON sessions(expires_at);

-- =========================================================
-- T06 기존 테이블
-- user_id는 먼저 nullable로 추가한다.
-- T06 기존 자료를 T07 계정으로 옮긴 뒤 API에서 소유권을 강제한다.
-- =========================================================

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  start_date date NOT NULL,
  end_date date NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  success_criteria text NOT NULL CHECK (length(trim(success_criteria)) > 0),
  estimated_minutes integer NOT NULL DEFAULT 0 CHECK (estimated_minutes >= 0),
  improvement_from_previous text,
  source_plan_id uuid REFERENCES plans(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_plans_user_created
  ON plans(user_id, created_at);

CREATE TABLE IF NOT EXISTS plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, version_no)
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  due_date date,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  tags text[] NOT NULL DEFAULT '{}',
  estimated_minutes integer NOT NULL DEFAULT 0 CHECK (estimated_minutes >= 0),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  completion_cycle integer NOT NULL DEFAULT 0 CHECK (completion_cycle >= 0),
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_plan_active
  ON tasks(plan_id, deleted_at, status);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date
  ON tasks(due_date);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key text PRIMARY KEY,
  scope text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completion_cycle integer NOT NULL CHECK (completion_cycle >= 0),
  idempotency_key text NOT NULL UNIQUE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, completion_cycle)
);

CREATE TABLE IF NOT EXISTS execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  actual_minutes integer NOT NULL CHECK (actual_minutes >= 0),
  blocker_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_execution_logs_task
  ON execution_logs(task_id, started_at);

CREATE TABLE IF NOT EXISTS reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  improvement_text text NOT NULL CHECK (length(trim(improvement_text)) > 0),
  carried_to_plan_id uuid REFERENCES plans(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL CHECK (length(content) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE security_checks
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_security_checks_user_created
  ON security_checks(user_id, created_at);

-- =========================================================
-- T07 카드 5: 5일 사용 설정
-- 한 계정당 하나의 질문/지표/계산 규칙을 고정한다.
-- =========================================================

CREATE TABLE IF NOT EXISTS t07_tracking_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (length(trim(question)) > 0),
  metric_name text NOT NULL CHECK (length(trim(metric_name)) > 0),
  metric_unit text NOT NULL CHECK (length(trim(metric_unit)) > 0),
  calculation_rule text NOT NULL CHECK (length(trim(calculation_rule)) > 0),
  plan_rule text NOT NULL CHECK (length(trim(plan_rule)) > 0),
  missing_value_rule text NOT NULL CHECK (length(trim(missing_value_rule)) > 0),
  duplicate_value_rule text NOT NULL CHECK (length(trim(duplicate_value_rule)) > 0),
  outlier_rule text NOT NULL CHECK (length(trim(outlier_rule)) > 0),
  rounding_rule text NOT NULL CHECK (length(trim(rounding_rule)) > 0),
  week_starts_on text NOT NULL CHECK (week_starts_on IN ('monday', 'sunday')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 서로 다른 날짜는 UNIQUE(user_id, record_date)로 보장한다.
-- 정확히 5일인지 여부는 API와 최종 검수에서 확인한다.
CREATE TABLE IF NOT EXISTS t07_daily_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_date date NOT NULL,
  metric_value numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, record_date)
);

CREATE INDEX IF NOT EXISTS idx_t07_daily_records_user_date
  ON t07_daily_records(user_id, record_date);

-- 과제는 계획 규칙을 "하나만" 바꾸므로 계정당 변경 기록을 한 건으로 제한한다.
CREATE TABLE IF NOT EXISTS t07_rule_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES t07_tracking_configs(id) ON DELETE CASCADE,
  old_plan_rule text NOT NULL CHECK (length(trim(old_plan_rule)) > 0),
  new_plan_rule text NOT NULL CHECK (length(trim(new_plan_rule)) > 0),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  day1_date date NOT NULL,
  day2_date date NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (day2_date > day1_date),
  CHECK (new_plan_rule <> old_plan_rule)
);

CREATE INDEX IF NOT EXISTS idx_t07_rule_changes_user
  ON t07_rule_changes(user_id);
