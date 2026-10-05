import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { seoulDateString } from "@/lib/pds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const planId = String(body.planId ?? "");
    const improvementText =
      String(body.improvementText ?? "").trim();

    if (!planId || !improvementText) {
      return NextResponse.json(
        {
          ok: false,
          error: "계획과 고칠 점 한 줄이 필요합니다.",
        },
        { status: 400 }
      );
    }

    const sql = getSql();
    const start = seoulDateString();

    const rows = await sql`
      WITH source_plan AS (
        SELECT *
        FROM plans
        WHERE id = ${planId}
          AND user_id = ${user.id}
      ), next_plan AS (
        INSERT INTO plans (
          user_id,
          title,
          start_date,
          end_date,
          priority,
          success_criteria,
          estimated_minutes,
          improvement_from_previous,
          source_plan_id
        )
        SELECT
          ${user.id},
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
        INSERT INTO reflections (
          plan_id,
          improvement_text,
          carried_to_plan_id
        )
        SELECT
          ${planId},
          ${improvementText},
          id
        FROM next_plan
        RETURNING *
      )
      SELECT
        n.*,
        r.id AS reflection_id
      FROM next_plan n
      CROSS JOIN reflection r
    `;

    if (!rows[0]) {
      return NextResponse.json(
        { ok: false, error: "기준 계획을 찾지 못했습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ok: true, nextPlan: rows[0] },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "다음 계획으로 넘기지 못했습니다.",
      },
      { status: 500 }
    );
  }
}
