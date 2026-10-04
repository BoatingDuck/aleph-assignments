CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE INDEX IF NOT EXISTS idx_tasks_plan_active ON tasks(plan_id, deleted_at, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

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

CREATE INDEX IF NOT EXISTS idx_execution_logs_task ON execution_logs(task_id, started_at);

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
