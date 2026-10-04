import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("planId");
    const taskId = searchParams.get("taskId");
    const sql = getSql();

    if (taskId) {
      const rows = await sql`
        SELECT e.*, t.title AS task_title
        FROM execution_logs e
        JOIN tasks t ON t.id = e.task_id
        WHERE e.task_id = ${taskId}
        ORDER BY e.started_at DESC, e.id DESC
      `;
      return NextResponse.json({ ok: true, executions: rows });
    }

    if (!planId) return NextResponse.json({ ok: false, error: "planId 또는 taskId가 필요합니다." }, { status: 400 });
    const rows = await sql`
      SELECT e.*, t.title AS task_title
      FROM execution_logs e
      JOIN tasks t ON t.id = e.task_id
      WHERE t.plan_id = ${planId} AND t.deleted_at IS NULL
      ORDER BY e.started_at DESC, e.id DESC
    `;
    return NextResponse.json({ ok: true, executions: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "실행 기록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const taskId = String(body.taskId ?? "");
    const startedAt = new Date(String(body.startedAt ?? ""));
    const endedAt = new Date(String(body.endedAt ?? ""));
    const blockerReason = String(body.blockerReason ?? "").trim() || null;

    if (!taskId || Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
      return NextResponse.json({ ok: false, error: "할 일·시작 시각·끝난 시각을 확인하세요." }, { status: 400 });
    }
    if (endedAt < startedAt) return NextResponse.json({ ok: false, error: "끝난 시각은 시작 시각보다 빠를 수 없습니다." }, { status: 400 });

    const actualMinutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
    const sql = getSql();
    const rows = await sql`
      INSERT INTO execution_logs (task_id, started_at, ended_at, actual_minutes, blocker_reason)
      VALUES (${taskId}, ${startedAt.toISOString()}, ${endedAt.toISOString()}, ${actualMinutes}, ${blockerReason})
      RETURNING *
    `;
    return NextResponse.json({ ok: true, execution: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "실행 기록을 저장하지 못했습니다." }, { status: 500 });
  }
}
