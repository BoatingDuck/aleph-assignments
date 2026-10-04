import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { asNonNegativeInt } from "@/lib/pds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT p.*,
             (SELECT count(*)::int FROM tasks t WHERE t.plan_id = p.id AND t.deleted_at IS NULL) AS task_count,
             (SELECT count(*)::int FROM plan_versions v WHERE v.plan_id = p.id) AS version_count
      FROM plans p
      ORDER BY p.created_at DESC, p.id DESC
    `;
    return NextResponse.json({ ok: true, plans: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "계획을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const successCriteria = String(body.successCriteria ?? "").trim();
    const startDate = String(body.startDate ?? "");
    const endDate = String(body.endDate ?? "");
    const priority = ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium";
    const estimatedMinutes = asNonNegativeInt(body.estimatedMinutes);
    const improvement = String(body.improvementFromPrevious ?? "").trim() || null;
    const sourcePlanId = body.sourcePlanId ? String(body.sourcePlanId) : null;

    if (!title || !successCriteria || !startDate || !endDate) {
      return NextResponse.json({ ok: false, error: "제목·기간·성공 기준은 필수입니다." }, { status: 400 });
    }

    const sql = getSql();
    const rows = await sql`
      INSERT INTO plans (title, start_date, end_date, priority, success_criteria, estimated_minutes, improvement_from_previous, source_plan_id)
      VALUES (${title}, ${startDate}, ${endDate}, ${priority}, ${successCriteria}, ${estimatedMinutes}, ${improvement}, ${sourcePlanId})
      RETURNING *
    `;
    return NextResponse.json({ ok: true, plan: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "계획을 저장하지 못했습니다." }, { status: 500 });
  }
}
