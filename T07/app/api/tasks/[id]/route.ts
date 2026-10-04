import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { asNonNegativeInt, cleanTags, dateValueToSeoulDateString } from "@/lib/pds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const sql = getSql();
    const currentRows = await sql`SELECT * FROM tasks WHERE id = ${id} AND deleted_at IS NULL`;
    const current = currentRows[0];
    if (!current) return NextResponse.json({ ok: false, error: "할 일이 없습니다." }, { status: 404 });

    const title = body.title === undefined ? current.title : String(body.title).trim();
    const dueDate = body.dueDate === undefined ? (current.due_date ? dateValueToSeoulDateString(current.due_date) : null) : (body.dueDate ? String(body.dueDate) : null);
    const priority = body.priority === undefined ? current.priority : (["low", "medium", "high"].includes(body.priority) ? body.priority : current.priority);
    const tags = body.tags === undefined ? current.tags : cleanTags(body.tags);
    const estimatedMinutes = body.estimatedMinutes === undefined ? current.estimated_minutes : asNonNegativeInt(body.estimatedMinutes);
    const requestedStatus = body.status === undefined ? current.status : String(body.status);
    const status = ["todo", "doing", "done"].includes(requestedStatus) ? requestedStatus : current.status;
    const reopening = current.status === "done" && status !== "done";

    if (!title) return NextResponse.json({ ok: false, error: "할 일 내용은 비워둘 수 없습니다." }, { status: 400 });

    const rows = await sql`
      UPDATE tasks
      SET title = ${title},
          due_date = ${dueDate},
          priority = ${priority},
          tags = ${tags},
          estimated_minutes = ${estimatedMinutes},
          status = ${status},
          completion_cycle = completion_cycle + CASE WHEN ${reopening} THEN 1 ELSE 0 END,
          completed_at = CASE
            WHEN ${reopening} THEN NULL
            WHEN ${status} = 'done' THEN COALESCE(completed_at, now())
            ELSE completed_at
          END,
          updated_at = now()
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING *
    `;
    return NextResponse.json({ ok: true, task: rows[0] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "할 일 수정에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const sql = getSql();
    const rows = await sql`
      UPDATE tasks SET deleted_at = now(), updated_at = now()
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING id
    `;
    if (!rows[0]) return NextResponse.json({ ok: false, error: "지울 할 일이 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "할 일을 지우지 못했습니다." }, { status: 500 });
  }
}
