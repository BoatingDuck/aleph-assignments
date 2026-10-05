import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const sql = getSql();

    const configRows = await sql`
      SELECT
        id, question, metric_name, metric_unit, calculation_rule, plan_rule,
        missing_value_rule, duplicate_value_rule, outlier_rule, rounding_rule,
        week_starts_on, created_at, updated_at
      FROM t07_tracking_configs
      WHERE user_id = ${user.id}
      LIMIT 1
    `;

    const changeRows = await sql`
      SELECT
        id, old_plan_rule, new_plan_rule, reason,
        day1_date, day2_date, changed_at
      FROM t07_rule_changes
      WHERE user_id = ${user.id}
      LIMIT 1
    `;

    const dayRows = await sql`
      SELECT record_date
      FROM t07_daily_records
      WHERE user_id = ${user.id}
      ORDER BY record_date ASC
    `;

    const dayDates = dayRows.map((row) => String(row.record_date));

    return NextResponse.json({
      ok: true,
      config: configRows[0] ?? null,
      ruleChange: changeRows[0] ?? null,
      dayCount: dayDates.length,
      dayDates,
    });
  } catch (error) {
    console.error("tracking-config GET failed", error);
    return NextResponse.json(
      { ok: false, error: "관찰 설정을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const newPlanRule = String(body?.newPlanRule ?? "").trim();
    const reason = String(body?.reason ?? "").trim();

    if (!newPlanRule || !reason) {
      return NextResponse.json(
        { ok: false, error: "새 계획 규칙과 변경 이유를 모두 입력하세요." },
        { status: 400 }
      );
    }

    const sql = getSql();

    const configRows = await sql`
      SELECT id, plan_rule
      FROM t07_tracking_configs
      WHERE user_id = ${user.id}
      LIMIT 1
    `;
    const config = configRows[0] as { id?: string; plan_rule?: string } | undefined;

    if (!config?.id || !config.plan_rule) {
      return NextResponse.json(
        { ok: false, error: "먼저 5일 관찰 설정을 저장하세요." },
        { status: 404 }
      );
    }

    const existingChangeRows = await sql`
      SELECT id
      FROM t07_rule_changes
      WHERE user_id = ${user.id}
      LIMIT 1
    `;
    if (existingChangeRows.length > 0) {
      return NextResponse.json(
        { ok: false, error: "계획 규칙은 이미 한 번 변경되었습니다." },
        { status: 409 }
      );
    }

    const dayRows = await sql`
      SELECT record_date
      FROM t07_daily_records
      WHERE user_id = ${user.id}
      ORDER BY record_date ASC
    `;

    if (dayRows.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Day 2 기록을 완료한 뒤 계획 규칙을 변경할 수 있습니다." },
        { status: 409 }
      );
    }

    if (dayRows.length > 2) {
      return NextResponse.json(
        { ok: false, error: "Day 3 기록이 이미 존재하여 계획 규칙을 변경할 수 없습니다." },
        { status: 409 }
      );
    }

    if (newPlanRule === config.plan_rule) {
      return NextResponse.json(
        { ok: false, error: "현재 계획 규칙과 다른 내용으로 입력하세요." },
        { status: 400 }
      );
    }

    const day1Date = String(dayRows[0].record_date);
    const day2Date = String(dayRows[1].record_date);

    await sql`
      INSERT INTO t07_rule_changes (
        user_id, config_id, old_plan_rule, new_plan_rule,
        reason, day1_date, day2_date
      )
      VALUES (
        ${user.id}, ${config.id}, ${config.plan_rule}, ${newPlanRule},
        ${reason}, ${day1Date}, ${day2Date}
      )
    `;

    await sql`
      UPDATE t07_tracking_configs
      SET plan_rule = ${newPlanRule}, updated_at = now()
      WHERE id = ${config.id}
        AND user_id = ${user.id}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("tracking-config PATCH failed", error);
    return NextResponse.json(
      { ok: false, error: "계획 규칙 변경을 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}
