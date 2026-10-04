import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { asNonNegativeInt } from "@/lib/pds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const sql = getSql();
    const plans = await sql`SELECT * FROM plans WHERE id = ${id}`;
    if (!plans[0]) return NextResponse.json({ ok: false, error: "계획이 없습니다." }, { status: 404 });
    const versions = await sql`
      SELECT id, plan_id, version_no, snapshot, created_at
      FROM plan_versions
      WHERE plan_id = ${id}
      ORDER BY version_no DESC
    `;
    return NextResponse.json({ ok: true, plan: plans[0], versions });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "계획을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const successCriteria = String(body.successCriteria ?? "").trim();
    const startDate = String(body.startDate ?? "");
    const endDate = String(body.endDate ?? "");
    const priority = ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium";
    const estimatedMinutes = asNonNegativeInt(body.estimatedMinutes);

    if (!title || !successCriteria || !startDate || !endDate) {
      return NextResponse.json({ ok: false, error: "제목·기간·성공 기준은 필수입니다." }, { status: 400 });
    }

    const sql = getSql();
    const rows = await sql`
      WITH current_plan AS (
        SELECT * FROM plans WHERE id = ${id}
      ), history AS (
        INSERT INTO plan_versions (plan_id, version_no, snapshot)
        SELECT
          c.id,
          COALESCE((SELECT max(v.version_no) FROM plan_versions v WHERE v.plan_id = c.id), 0) + 1,
          jsonb_build_object(
            'title', c.title,
            'start_date', c.start_date,
            'end_date', c.end_date,
            'priority', c.priority,
            'success_criteria', c.success_criteria,
            'estimated_minutes', c.estimated_minutes,
            'improvement_from_previous', c.improvement_from_previous,
            'captured_at', now()
          )
        FROM current_plan c
        RETURNING id
      )
      UPDATE plans
      SET title = ${title},
          start_date = ${startDate},
          end_date = ${endDate},
          priority = ${priority},
          success_criteria = ${successCriteria},
          estimated_minutes = ${estimatedMinutes},
          updated_at = now()
      WHERE id = ${id} AND EXISTS (SELECT 1 FROM history)
      RETURNING *
    `;

    if (!rows[0]) return NextResponse.json({ ok: false, error: "수정할 계획이 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true, plan: rows[0] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "계획 수정에 실패했습니다." }, { status: 500 });
  }
}


export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const sql = getSql();
    const rows = await sql`
      WITH task_ids AS MATERIALIZED (
        SELECT t.id::text AS id
        FROM tasks t
        WHERE t.plan_id = ${id}
      ), deleted_keys AS (
        DELETE FROM idempotency_keys k
        USING task_ids t
        WHERE k.scope = ('complete:' || t.id)
        RETURNING k.key
      ), deleted_reflections AS (
        DELETE FROM reflections r
        WHERE r.plan_id = ${id} OR r.carried_to_plan_id = ${id}
        RETURNING r.id
      ), deleted_plan AS (
        DELETE FROM plans p
        WHERE p.id = ${id}
        RETURNING p.id, p.title
      )
      SELECT
        p.id,
        p.title,
        (SELECT count(*)::int FROM deleted_keys) AS deleted_idempotency_keys,
        (SELECT count(*)::int FROM deleted_reflections) AS deleted_reflections
      FROM deleted_plan p
    `;

    if (!rows[0]) {
      return NextResponse.json({ ok: false, error: "삭제할 계획이 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, deleted: rows[0] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "계획 삭제에 실패했습니다." }, { status: 500 });
  }
}
