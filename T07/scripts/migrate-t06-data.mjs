import fs from "node:fs/promises";
import process, { loadEnvFile } from "node:process";
import { neon } from "@neondatabase/serverless";

try {
  loadEnvFile(".env.local");
} catch {}

const targetUrl = process.env.DATABASE_URL;
const sourceUrl = process.env.T06_DATABASE_URL;
const ownerLoginId = String(process.argv[2] ?? "").trim().toLowerCase();

if (!targetUrl) {
  console.error("DATABASE_URL(T07)이 없습니다.");
  process.exit(1);
}

if (!sourceUrl) {
  console.error("T06_DATABASE_URL이 없습니다.");
  process.exit(1);
}

if (!ownerLoginId) {
  console.error(
    '사용법: node scripts/migrate-t06-data.mjs "T07에서 사용할_내_로그인아이디"'
  );
  process.exit(1);
}

if (targetUrl === sourceUrl) {
  console.error("중단: T06_DATABASE_URL과 DATABASE_URL이 같습니다. T06 DB 원본은 수정하지 않습니다.");
  process.exit(1);
}

const source = neon(sourceUrl);
const target = neon(targetUrl);

function iso(value) {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function dateOnly(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

async function readSource() {
  const [
    plans,
    planVersions,
    tasks,
    idempotencyKeys,
    completions,
    executions,
    reflections,
    securityChecks,
  ] = await Promise.all([
    source`SELECT * FROM plans ORDER BY created_at ASC, id ASC`,
    source`SELECT * FROM plan_versions ORDER BY created_at ASC, id ASC`,
    source`SELECT * FROM tasks ORDER BY created_at ASC, id ASC`,
    source`SELECT * FROM idempotency_keys ORDER BY created_at ASC, key ASC`,
    source`SELECT * FROM task_completions ORDER BY completed_at ASC, id ASC`,
    source`SELECT * FROM execution_logs ORDER BY created_at ASC, id ASC`,
    source`SELECT * FROM reflections ORDER BY created_at ASC, id ASC`,
    source`SELECT * FROM security_checks ORDER BY created_at ASC, id ASC`,
  ]);

  return {
    plans,
    planVersions,
    tasks,
    idempotencyKeys,
    completions,
    executions,
    reflections,
    securityChecks,
  };
}

async function findOwner() {
  const rows = await target`
    SELECT id, login_id
    FROM users
    WHERE lower(login_id) = ${ownerLoginId}
    LIMIT 1
  `;

  if (!rows[0]) {
    throw new Error(
      `T07 DB에서 '${ownerLoginId}' 계정을 찾지 못했습니다. 먼저 그 계정으로 가입해 주세요.`
    );
  }

  return rows[0];
}

async function migrate(data, ownerId) {
  // 1) plans: self FK(source_plan_id)는 일단 NULL로 넣고 뒤에서 연결한다.
  for (const row of data.plans) {
    await target`
      INSERT INTO plans (
        id,
        user_id,
        title,
        start_date,
        end_date,
        priority,
        success_criteria,
        estimated_minutes,
        improvement_from_previous,
        source_plan_id,
        created_at,
        updated_at
      )
      VALUES (
        ${row.id},
        ${ownerId},
        ${row.title},
        ${dateOnly(row.start_date)},
        ${dateOnly(row.end_date)},
        ${row.priority},
        ${row.success_criteria},
        ${Number(row.estimated_minutes ?? 0)},
        ${row.improvement_from_previous ?? null},
        NULL,
        ${iso(row.created_at)},
        ${iso(row.updated_at)}
      )
      ON CONFLICT (id) DO UPDATE
      SET user_id = EXCLUDED.user_id
    `;
  }

  for (const row of data.plans) {
    if (!row.source_plan_id) continue;

    await target`
      UPDATE plans
      SET source_plan_id = ${row.source_plan_id}
      WHERE id = ${row.id}
        AND user_id = ${ownerId}
    `;
  }

  // 2) plan_versions
  for (const row of data.planVersions) {
    await target`
      INSERT INTO plan_versions (
        id,
        plan_id,
        version_no,
        snapshot,
        created_at
      )
      VALUES (
        ${row.id},
        ${row.plan_id},
        ${Number(row.version_no)},
        ${JSON.stringify(row.snapshot)}::jsonb,
        ${iso(row.created_at)}
      )
      ON CONFLICT DO NOTHING
    `;
  }

  // 3) tasks
  for (const row of data.tasks) {
    await target`
      INSERT INTO tasks (
        id,
        plan_id,
        title,
        due_date,
        priority,
        tags,
        estimated_minutes,
        status,
        completion_cycle,
        completed_at,
        deleted_at,
        created_at,
        updated_at
      )
      VALUES (
        ${row.id},
        ${row.plan_id},
        ${row.title},
        ${dateOnly(row.due_date)},
        ${row.priority},
        ${row.tags ?? []},
        ${Number(row.estimated_minutes ?? 0)},
        ${row.status},
        ${Number(row.completion_cycle ?? 0)},
        ${iso(row.completed_at)},
        ${iso(row.deleted_at)},
        ${iso(row.created_at)},
        ${iso(row.updated_at)}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  // 4) idempotency_keys
  for (const row of data.idempotencyKeys) {
    await target`
      INSERT INTO idempotency_keys (key, scope, created_at)
      VALUES (${row.key}, ${row.scope}, ${iso(row.created_at)})
      ON CONFLICT (key) DO NOTHING
    `;
  }

  // 5) task_completions
  for (const row of data.completions) {
    await target`
      INSERT INTO task_completions (
        id,
        task_id,
        completion_cycle,
        idempotency_key,
        completed_at
      )
      VALUES (
        ${row.id},
        ${row.task_id},
        ${Number(row.completion_cycle)},
        ${row.idempotency_key},
        ${iso(row.completed_at)}
      )
      ON CONFLICT DO NOTHING
    `;
  }

  // 6) execution_logs
  for (const row of data.executions) {
    await target`
      INSERT INTO execution_logs (
        id,
        task_id,
        started_at,
        ended_at,
        actual_minutes,
        blocker_reason,
        created_at
      )
      VALUES (
        ${row.id},
        ${row.task_id},
        ${iso(row.started_at)},
        ${iso(row.ended_at)},
        ${Number(row.actual_minutes ?? 0)},
        ${row.blocker_reason ?? null},
        ${iso(row.created_at)}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  // 7) reflections
  for (const row of data.reflections) {
    await target`
      INSERT INTO reflections (
        id,
        plan_id,
        improvement_text,
        carried_to_plan_id,
        created_at
      )
      VALUES (
        ${row.id},
        ${row.plan_id},
        ${row.improvement_text},
        ${row.carried_to_plan_id ?? null},
        ${iso(row.created_at)}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  // 8) security_checks: T06에는 user_id가 없었으므로 내 T07 계정에 연결한다.
  for (const row of data.securityChecks) {
    await target`
      INSERT INTO security_checks (
        id,
        user_id,
        content,
        created_at
      )
      VALUES (
        ${row.id},
        ${ownerId},
        ${row.content},
        ${iso(row.created_at)}
      )
      ON CONFLICT (id) DO UPDATE
      SET user_id = EXCLUDED.user_id
    `;
  }
}

async function verify(data, ownerId) {
  const [
    targetPlans,
    targetPlanVersions,
    targetTasks,
    targetKeys,
    targetCompletions,
    targetExecutions,
    targetReflections,
    targetSecurityChecks,
  ] = await Promise.all([
    target`SELECT id, user_id FROM plans`,
    target`SELECT id FROM plan_versions`,
    target`SELECT id FROM tasks`,
    target`SELECT key FROM idempotency_keys`,
    target`SELECT id FROM task_completions`,
    target`SELECT id FROM execution_logs`,
    target`SELECT id FROM reflections`,
    target`SELECT id, user_id FROM security_checks`,
  ]);

  const idSet = (rows) => new Set(rows.map((row) => String(row.id)));
  const keySet = new Set(targetKeys.map((row) => String(row.key)));

  const planMap = new Map(
    targetPlans.map((row) => [String(row.id), String(row.user_id ?? "")])
  );
  const securityMap = new Map(
    targetSecurityChecks.map((row) => [String(row.id), String(row.user_id ?? "")])
  );

  const checks = {
    plans: {
      source: data.plans.length,
      matched: data.plans.filter(
        (row) => planMap.get(String(row.id)) === String(ownerId)
      ).length,
    },
    planVersions: {
      source: data.planVersions.length,
      matched: data.planVersions.filter((row) =>
        idSet(targetPlanVersions).has(String(row.id))
      ).length,
    },
    tasks: {
      source: data.tasks.length,
      matched: data.tasks.filter((row) =>
        idSet(targetTasks).has(String(row.id))
      ).length,
    },
    idempotencyKeys: {
      source: data.idempotencyKeys.length,
      matched: data.idempotencyKeys.filter((row) =>
        keySet.has(String(row.key))
      ).length,
    },
    completions: {
      source: data.completions.length,
      matched: data.completions.filter((row) =>
        idSet(targetCompletions).has(String(row.id))
      ).length,
    },
    executions: {
      source: data.executions.length,
      matched: data.executions.filter((row) =>
        idSet(targetExecutions).has(String(row.id))
      ).length,
    },
    reflections: {
      source: data.reflections.length,
      matched: data.reflections.filter((row) =>
        idSet(targetReflections).has(String(row.id))
      ).length,
    },
    securityChecks: {
      source: data.securityChecks.length,
      matched: data.securityChecks.filter(
        (row) => securityMap.get(String(row.id)) === String(ownerId)
      ).length,
    },
  };

  const ok = Object.values(checks).every(
    (item) => item.source === item.matched
  );

  return { ok, checks };
}

try {
  console.log("T06 원본 DB 읽는 중...");
  const data = await readSource();

  console.log("T07 소유 계정 확인 중...");
  const owner = await findOwner();

  console.log(`T07 계정 확인 완료: ${owner.login_id}`);
  console.log("T06 → T07 자료 복사 중...");
  await migrate(data, owner.id);

  console.log("복사 결과 검증 중...");
  const verification = await verify(data, owner.id);

  const report = {
    migration: "T06 Neon -> T07 Neon",
    completedAt: new Date().toISOString(),
    success: verification.ok,
    counts: verification.checks,
    note:
      "비밀번호·세션·DB 연결 문자열은 이 보고서에 기록하지 않는다.",
  };

  await fs.writeFile(
    "T07-T06-MIGRATION-REPORT.json",
    JSON.stringify(report, null, 2) + "\n",
    "utf8"
  );

  console.log("");
  console.log("=== T06 → T07 이전 결과 ===");
  for (const [name, item] of Object.entries(verification.checks)) {
    console.log(`${name}: ${item.matched}/${item.source}`);
  }

  if (!verification.ok) {
    console.error(
      "일부 자료 검증에 실패했습니다. T07-T06-MIGRATION-REPORT.json을 확인하세요."
    );
    process.exit(1);
  }

  console.log("");
  console.log("T06 기존 자료 이전 완료");
  console.log("보고서: T07-T06-MIGRATION-REPORT.json");
} catch (error) {
  console.error(
    "T06 자료 이전 실패:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
}
