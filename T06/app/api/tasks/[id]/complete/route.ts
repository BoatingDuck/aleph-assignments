import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const idempotencyKey = String(body.idempotencyKey ?? request.headers.get("idempotency-key") ?? "").trim();
    if (!idempotencyKey) return NextResponse.json({ ok: false, error: "idempotencyKey가 필요합니다." }, { status: 400 });

    const sql = getSql();
    const rows = await sql`
      WITH key_insert AS (
        INSERT INTO idempotency_keys (key, scope)
        VALUES (${idempotencyKey}, ${`complete:${id}`})
        ON CONFLICT (key) DO NOTHING
        RETURNING key
      ), task_update AS (
        UPDATE tasks
        SET status = 'done', completed_at = now(), updated_at = now()
        WHERE id = ${id}
          AND deleted_at IS NULL
          AND status <> 'done'
          AND EXISTS (SELECT 1 FROM key_insert)
        RETURNING id, completion_cycle
      ), completion_insert AS (
        INSERT INTO task_completions (task_id, completion_cycle, idempotency_key)
        SELECT id, completion_cycle, ${idempotencyKey}
        FROM task_update
        ON CONFLICT (task_id, completion_cycle) DO NOTHING
        RETURNING id
      )
      SELECT t.*,
             (SELECT count(*)::int FROM completion_insert) AS completion_rows_added
      FROM tasks t
      WHERE t.id = ${id} AND t.deleted_at IS NULL
    `;

    if (!rows[0]) return NextResponse.json({ ok: false, error: "완료할 할 일이 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true, task: rows[0], deduplicated: Number(rows[0].completion_rows_added) === 0 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "완료 처리에 실패했습니다." }, { status: 500 });
  }
}
