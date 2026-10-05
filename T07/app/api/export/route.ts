import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { dateValueToSeoulDateString } from "@/lib/pds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const sql = getSql();

    const [
      plans,
      planVersions,
      tasks,
      executions,
      completions,
      reflections,
      securityChecks,
    ] = await Promise.all([
      sql`
        SELECT *
        FROM plans
        WHERE user_id = ${user.id}
        ORDER BY created_at ASC
      `,
      sql`
        SELECT v.*
        FROM plan_versions v
        JOIN plans p ON p.id = v.plan_id
        WHERE p.user_id = ${user.id}
        ORDER BY v.created_at ASC
      `,
      sql`
        SELECT t.*
        FROM tasks t
        JOIN plans p ON p.id = t.plan_id
        WHERE p.user_id = ${user.id}
        ORDER BY t.created_at ASC
      `,
      sql`
        SELECT e.*
        FROM execution_logs e
        JOIN tasks t ON t.id = e.task_id
        JOIN plans p ON p.id = t.plan_id
        WHERE p.user_id = ${user.id}
        ORDER BY e.created_at ASC
      `,
      sql`
        SELECT
          c.id,
          c.task_id,
          c.completion_cycle,
          c.completed_at
        FROM task_completions c
        JOIN tasks t ON t.id = c.task_id
        JOIN plans p ON p.id = t.plan_id
        WHERE p.user_id = ${user.id}
        ORDER BY c.completed_at ASC
      `,
      sql`
        SELECT r.*
        FROM reflections r
        JOIN plans p ON p.id = r.plan_id
        WHERE p.user_id = ${user.id}
        ORDER BY r.created_at ASC
      `,
      sql`
        SELECT *
        FROM security_checks
        WHERE user_id = ${user.id}
        ORDER BY created_at ASC
      `,
    ]);

    const normalizedPlans = plans.map((plan) => ({
      ...plan,
      start_date:
        dateValueToSeoulDateString(plan.start_date),
      end_date:
        dateValueToSeoulDateString(plan.end_date),
    }));

    const normalizedTasks = tasks.map((task) => ({
      ...task,
      due_date: task.due_date
        ? dateValueToSeoulDateString(task.due_date)
        : null,
    }));

    const payload = {
      schema: "pds-schema-v2",
      exportedAt: new Date().toISOString(),
      timezoneDisplay: "Asia/Seoul",
      account: {
        loginId: user.loginId,
      },
      units: {
        duration: "minutes",
      },
      data: {
        plans: normalizedPlans,
        planVersions,
        tasks: normalizedTasks,
        executions,
        completions,
        reflections,
        securityChecks,
      },
    };

    return new NextResponse(
      JSON.stringify(payload, null, 2),
      {
        headers: {
          "content-type":
            "application/json; charset=utf-8",
          "content-disposition":
            `attachment; filename="plan-do-see-export-${new Date()
              .toISOString()
              .slice(0, 10)}.json"`,
          "cache-control": "no-store",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "내보내기에 실패했습니다." },
      { status: 500 }
    );
  }
}
