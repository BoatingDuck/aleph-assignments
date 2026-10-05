import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const idempotencyKey = String(
      body.idempotencyKey ??
        request.headers.get("idempotency-key") ??
        ""
    ).trim();

    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "idempotencyKey가 필요합니다." },
        { status: 400 }
      );
    }

    const sql = getSql();

    const ownedTask = await sql`
      SELECT t.id
      FROM tasks t
      JOIN plans p ON p.id = t.plan_id
      WHERE t.id = ${id}
        AND p.user_id = ${user.id}
        AND t.deleted_at IS NULL
      LIMIT 1
    `;

    if (!ownedTask[0]) {
      return NextResponse.json(
        { ok: false, error: "완료할 할 일이 없습니다." },
        { status: 404 }
      );
    }

    const rows = await sql`
      WITH key_insert AS (
        INSERT INTO idempotency_keys (key, scope)
        VALUES (${idempotencyKey}, ${`complete:${id}`})
        ON CONFLICT (key) DO NOTHING
        RETURNING key
      ), task_update AS (
        UPDATE tasks t
        SET status = 'done',
            completed_at = now(),
            updated_at = now()
        WHERE t.id = ${id}
          AND t.deleted_at IS NULL
          AND t.status <> 'done'
          AND EXISTS (SELECT 1 FROM key_insert)
          AND EXISTS (
            SELECT 1
            FROM plans p
            WHERE p.id = t.plan_id
              AND p.user_id = ${user.id}
          )
        RETURNING t.id, t.completion_cycle
      ), completion_insert AS (
        INSERT INTO task_completions (
          task_id,
          completion_cycle,
          idempotency_key
        )
        SELECT id, completion_cycle, ${idempotencyKey}
        FROM task_update
        ON CONFLICT (task_id, completion_cycle) DO NOTHING
        RETURNING id
      )
      SELECT
        t.*,
        (SELECT count(*)::int FROM completion_insert)
          AS completion_rows_added
      FROM tasks t
      JOIN plans p ON p.id = t.plan_id
      WHERE t.id = ${id}
        AND p.user_id = ${user.id}
        AND t.deleted_at IS NULL
    `;

    if (!rows[0]) {
      return NextResponse.json(
        { ok: false, error: "완료할 할 일이 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      task: rows[0],
      deduplicated:
        Number(rows[0].completion_rows_added) === 0,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "완료 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}
