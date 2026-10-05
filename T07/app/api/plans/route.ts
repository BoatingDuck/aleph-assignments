import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { asNonNegativeInt } from "@/lib/pds";

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
    const rows = await sql`
      SELECT p.*,
             (SELECT count(*)::int
                FROM tasks t
               WHERE t.plan_id = p.id
                 AND t.deleted_at IS NULL) AS task_count,
             (SELECT count(*)::int
                FROM plan_versions v
               WHERE v.plan_id = p.id) AS version_count
      FROM plans p
      WHERE p.user_id = ${user.id}
      ORDER BY p.created_at DESC, p.id DESC
    `;

    return NextResponse.json({ ok: true, plans: rows });
  } catch {
    return NextResponse.json(
      { ok: false, error: "계획을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

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
    const title = String(body.title ?? "").trim();
    const successCriteria = String(body.successCriteria ?? "").trim();
    const startDate = String(body.startDate ?? "");
    const endDate = String(body.endDate ?? "");
    const priority = ["low", "medium", "high"].includes(body.priority)
      ? body.priority
      : "medium";
    const estimatedMinutes = asNonNegativeInt(body.estimatedMinutes);
    const improvement =
      String(body.improvementFromPrevious ?? "").trim() || null;
    const sourcePlanId = body.sourcePlanId ? String(body.sourcePlanId) : null;

    if (!title || !successCriteria || !startDate || !endDate) {
      return NextResponse.json(
        { ok: false, error: "제목·기간·성공 기준은 필수입니다." },
        { status: 400 }
      );
    }

    const sql = getSql();

    if (sourcePlanId) {
      const ownedSource = await sql`
        SELECT id
        FROM plans
        WHERE id = ${sourcePlanId}
          AND user_id = ${user.id}
        LIMIT 1
      `;

      if (!ownedSource[0]) {
        return NextResponse.json(
          { ok: false, error: "기준 계획을 찾지 못했습니다." },
          { status: 404 }
        );
      }
    }

    const rows = await sql`
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
      VALUES (
        ${user.id},
        ${title},
        ${startDate},
        ${endDate},
        ${priority},
        ${successCriteria},
        ${estimatedMinutes},
        ${improvement},
        ${sourcePlanId}
      )
      RETURNING *
    `;

    return NextResponse.json(
      { ok: true, plan: rows[0] },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "계획을 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}
