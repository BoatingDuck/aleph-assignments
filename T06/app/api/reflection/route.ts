import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { dateValueToSeoulDateString, seoulDateString } from "@/lib/pds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReflectionTaskRow = {
  id: string;
  status: "todo" | "doing" | "done";
  due_date: unknown;
  estimated_minutes: number | string | null;
  [key: string]: unknown;
};

type NormalizedReflectionTask = Omit<ReflectionTaskRow, "due_date"> & {
  due_date: string | null;
};

export async function GET(request: Request) {
  try {
    const planId = new URL(request.url).searchParams.get("planId");
    if (!planId) return NextResponse.json({ ok: false, error: "planId가 필요합니다." }, { status: 400 });

    const sql = getSql();
    const tasks = [...await sql`
      SELECT * FROM tasks
      WHERE plan_id = ${planId} AND deleted_at IS NULL
      ORDER BY created_at ASC, id ASC
    `] as ReflectionTaskRow[];
    const logs = [...await sql`
      SELECT e.*, t.title AS task_title
      FROM execution_logs e
      JOIN tasks t ON t.id = e.task_id
      WHERE t.plan_id = ${planId} AND t.deleted_at IS NULL
      ORDER BY e.started_at ASC, e.id ASC
    `] as Array<Record<string, any>>;

    const normalizedTasks: NormalizedReflectionTask[] = tasks.map((task) => ({
      ...task,
      due_date: task.due_date ? dateValueToSeoulDateString(task.due_date) : null
    }));
    const todaySeoul = seoulDateString();
    const done = normalizedTasks.filter((task) => task.status === "done");
    const delayed = normalizedTasks.filter((task) => task.status !== "done" && task.due_date && task.due_date < todaySeoul);
    const blockedIds = new Set(logs.filter((log) => String(log.blocker_reason ?? "").trim()).map((log) => String(log.task_id)));
    const blocked = normalizedTasks.filter((task) => blockedIds.has(String(task.id)));
    const estimatedMinutes = normalizedTasks.reduce((sum, task) => sum + Number(task.estimated_minutes || 0), 0);
    const actualMinutes = logs.reduce((sum, log) => sum + Number(log.actual_minutes || 0), 0);

    const reflectionRows = await sql`
      SELECT * FROM reflections WHERE plan_id = ${planId} ORDER BY created_at DESC
    `;

    return NextResponse.json({
      ok: true,
      todaySeoul,
      metrics: {
        planCount: normalizedTasks.length,
        doneCount: done.length,
        delayedCount: delayed.length,
        blockedCount: blocked.length,
        estimatedMinutes,
        actualMinutes,
        differenceMinutes: actualMinutes - estimatedMinutes
      },
      details: {
        plan: normalizedTasks,
        done,
        delayed,
        blocked,
        estimated: normalizedTasks,
        actual: logs
      },
      reflections: reflectionRows
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "돌아보기를 계산하지 못했습니다." }, { status: 500 });
  }
}
