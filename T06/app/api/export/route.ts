import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { dateValueToSeoulDateString } from "@/lib/pds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getSql();
    const [plans, planVersions, tasks, executions, completions, reflections, securityChecks] = await Promise.all([
      sql`SELECT * FROM plans ORDER BY created_at ASC`,
      sql`SELECT * FROM plan_versions ORDER BY created_at ASC`,
      sql`SELECT * FROM tasks ORDER BY created_at ASC`,
      sql`SELECT * FROM execution_logs ORDER BY created_at ASC`,
      sql`SELECT id, task_id, completion_cycle, completed_at FROM task_completions ORDER BY completed_at ASC`,
      sql`SELECT * FROM reflections ORDER BY created_at ASC`,
      sql`SELECT * FROM security_checks ORDER BY created_at ASC`
    ]);

    const normalizedPlans = plans.map((plan) => ({
      ...plan,
      start_date: dateValueToSeoulDateString(plan.start_date),
      end_date: dateValueToSeoulDateString(plan.end_date)
    }));
    const normalizedTasks = tasks.map((task) => ({
      ...task,
      due_date: task.due_date ? dateValueToSeoulDateString(task.due_date) : null
    }));

    const payload = {
      schema: "pds-schema-v2",
      exportedAt: new Date().toISOString(),
      timezoneDisplay: "Asia/Seoul",
      units: { duration: "minutes" },
      data: { plans: normalizedPlans, planVersions, tasks: normalizedTasks, executions, completions, reflections, securityChecks }
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="plan-do-see-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "내보내기에 실패했습니다." }, { status: 500 });
  }
}
