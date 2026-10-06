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
      trackingConfigs,
      dailyRecords,
      ruleChanges,
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
      sql`
        SELECT
          id,
          question,
          metric_name,
          metric_unit,
          calculation_rule,
          plan_rule,
          missing_value_rule,
          duplicate_value_rule,
          outlier_rule,
          rounding_rule,
          week_starts_on,
          created_at,
          updated_at
        FROM t07_tracking_configs
        WHERE user_id = ${user.id}
        ORDER BY created_at ASC
      `,
      sql`
        SELECT
          id,
          record_date,
          metric_value,
          note,
          created_at
        FROM t07_daily_records
        WHERE user_id = ${user.id}
        ORDER BY record_date ASC
      `,
      sql`
        SELECT
          id,
          old_plan_rule,
          new_plan_rule,
          reason,
          day1_date,
          day2_date,
          changed_at
        FROM t07_rule_changes
        WHERE user_id = ${user.id}
        ORDER BY changed_at ASC
      `,
    ]);

    const normalizedPlans = plans.map((plan) => ({
      ...plan,
      start_date: dateValueToSeoulDateString(plan.start_date),
      end_date: dateValueToSeoulDateString(plan.end_date),
    }));

    const normalizedTasks = tasks.map((task) => ({
      ...task,
      due_date: task.due_date
        ? dateValueToSeoulDateString(task.due_date)
        : null,
    }));

    const normalizedDailyRecords = dailyRecords.map((record) => ({
      ...record,
      record_date: dateValueToSeoulDateString(record.record_date),
    }));

    const normalizedRuleChanges = ruleChanges.map((change) => ({
      ...change,
      day1_date: dateValueToSeoulDateString(change.day1_date),
      day2_date: dateValueToSeoulDateString(change.day2_date),
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
        trackingConfigs,
        dailyRecords: normalizedDailyRecords,
        ruleChanges: normalizedRuleChanges,
      },
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="plan-do-see-export-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "내보내기에 실패했습니다." },
      { status: 500 }
    );
  }
}
