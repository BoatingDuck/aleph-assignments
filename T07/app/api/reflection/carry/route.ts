import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { seoulDateString } from "@/lib/pds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const planId = String(body.planId ?? "");
    const improvementText = String(body.improvementText ?? "").trim();

    if (!planId || !improvementText) {
      return NextResponse.json(
        { ok: false, error: "계획과 고칠 점 한 줄이 필요합니다." },
        { status: 400 }
      );
    }

    const sql = getSql();
    const start = seoulDateString();

    // PostgreSQL DATE 값을 JavaScript 문자열로 바꿨다가 다시 DATE에 넣지 않는다.
    // 날짜 비교/복사는 DB 안에서 처리해 로컬과 Vercel의 timezone 차이에도 안전하게 유지한다.
    const rows = await sql`
      WITH source_plan AS (
        SELECT *
        FROM plans
        WHERE id = ${planId}
      ), next_plan AS (
        INSERT INTO plans (
          title, start_date, end_date, priority, success_criteria, estimated_minutes,
          improvement_from_previous, source_plan_id
        )
        SELECT
          s.title || ' · 다음 계획',
          ${start}::date,
          GREATEST(s.end_date, ${start}::date),
          s.priority,
          s.success_criteria,
          s.estimated_minutes,
          ${improvementText},
          s.id
        FROM source_plan s
        RETURNING *
      ), reflection AS (
        INSERT INTO reflections (plan_id, improvement_text, carried_to_plan_id)
        SELECT ${planId}, ${improvementText}, id
        FROM next_plan
        RETURNING *
      )
      SELECT n.*, r.id AS reflection_id
      FROM next_plan n
      CROSS JOIN reflection r
    `;

    if (!rows[0]) {
      return NextResponse.json(
        { ok: false, error: "기준 계획을 찾지 못했습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, nextPlan: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "다음 계획으로 넘기지 못했습니다."
      },
      { status: 500 }
    );
  }
}
