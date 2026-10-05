import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { asNonNegativeInt } from "@/lib/pds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const sql = getSql();

    const plans = await sql`
      SELECT *
      FROM plans
      WHERE id = ${id}
        AND user_id = ${user.id}
      LIMIT 1
    `;

    if (!plans[0]) {
      return NextResponse.json(
        { ok: false, error: "계획이 없습니다." },
        { status: 404 }
      );
    }

    const versions = await sql`
      SELECT v.id, v.plan_id, v.version_no, v.snapshot, v.created_at
      FROM plan_versions v
      JOIN plans p ON p.id = v.plan_id
      WHERE v.plan_id = ${id}
        AND p.user_id = ${user.id}
      ORDER BY v.version_no DESC
    `;

    return NextResponse.json({
      ok: true,
      plan: plans[0],
      versions,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "계획을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const successCriteria = String(body.successCriteria ?? "").trim();
    const startDate = String(body.startDate ?? "");
    const endDate = String(body.endDate ?? "");
    const priority = ["low", "medium", "high"].includes(body.priority)
      ? body.priority
      : "medium";
    const estimatedMinutes = asNonNegativeInt(body.estimatedMinutes);

    if (!title || !successCriteria || !startDate || !endDate) {
      return NextResponse.json(
        { ok: false, error: "제목·기간·성공 기준은 필수입니다." },
        { status: 400 }
      );
    }

    const sql = getSql();

    const rows = await sql`
      WITH current_plan AS (
        SELECT *
        FROM plans
        WHERE id = ${id}
          AND user_id = ${user.id}
      ), history AS (
        INSERT INTO plan_versions (plan_id, version_no, snapshot)
        SELECT
          c.id,
          COALESCE(
            (
              SELECT max(v.version_no)
              FROM plan_versions v
              WHERE v.plan_id = c.id
            ),
            0
          ) + 1,
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
      WHERE id = ${id}
        AND user_id = ${user.id}
        AND EXISTS (SELECT 1 FROM history)
      RETURNING *
    `;

    if (!rows[0]) {
      return NextResponse.json(
        { ok: false, error: "수정할 계획이 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, plan: rows[0] });
  } catch {
    return NextResponse.json(
      { ok: false, error: "계획 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const sql = getSql();

    const rows = await sql`
      WITH owned_plan AS MATERIALIZED (
        SELECT p.id, p.title
        FROM plans p
        WHERE p.id = ${id}
          AND p.user_id = ${user.id}
      ), task_ids AS MATERIALIZED (
        SELECT t.id::text AS id
        FROM tasks t
        JOIN owned_plan p ON p.id = t.plan_id
      ), deleted_keys AS (
        DELETE FROM idempotency_keys k
        USING task_ids t
        WHERE k.scope = ('complete:' || t.id)
        RETURNING k.key
      ), deleted_reflections AS (
        DELETE FROM reflections r
        USING owned_plan p
        WHERE r.plan_id = p.id
           OR r.carried_to_plan_id = p.id
        RETURNING r.id
      ), deleted_plan AS (
        DELETE FROM plans p
        USING owned_plan o
        WHERE p.id = o.id
          AND p.user_id = ${user.id}
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
      return NextResponse.json(
        { ok: false, error: "삭제할 계획이 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, deleted: rows[0] });
  } catch {
    return NextResponse.json(
      { ok: false, error: "계획 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
