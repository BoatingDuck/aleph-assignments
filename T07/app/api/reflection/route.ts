import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import {
  dateValueToSeoulDateString,
  seoulDateString,
} from "@/lib/pds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReflectionTaskRow = {
  id: string;
  status: "todo" | "doing" | "done";
  due_date: unknown;
  estimated_minutes: number | string | null;
  [key: string]: unknown;
};

type NormalizedReflectionTask =
  Omit<ReflectionTaskRow, "due_date"> & {
    due_date: string | null;
  };

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const planId =
      new URL(request.url).searchParams.get("planId");

    if (!planId) {
      return NextResponse.json(
        { ok: false, error: "planId가 필요합니다." },
        { status: 400 }
      );
    }

    const sql = getSql();

    const ownedPlan = await sql`
      SELECT id
      FROM plans
      WHERE id = ${planId}
        AND user_id = ${user.id}
      LIMIT 1
    `;

    if (!ownedPlan[0]) {
      return NextResponse.json(
        { ok: false, error: "계획을 찾지 못했습니다." },
        { status: 404 }
      );
    }

    const tasks = [
      ...(await sql`
        SELECT t.*
        FROM tasks t
        JOIN plans p ON p.id = t.plan_id
        WHERE t.plan_id = ${planId}
          AND p.user_id = ${user.id}
          AND t.deleted_at IS NULL
        ORDER BY t.created_at ASC, t.id ASC
      `),
    ] as ReflectionTaskRow[];

    const logs = [
      ...(await sql`
        SELECT e.*, t.title AS task_title
        FROM execution_logs e
        JOIN tasks t ON t.id = e.task_id
        JOIN plans p ON p.id = t.plan_id
        WHERE t.plan_id = ${planId}
          AND p.user_id = ${user.id}
          AND t.deleted_at IS NULL
        ORDER BY e.started_at ASC, e.id ASC
      `),
    ] as Array<Record<string, any>>;

    const normalizedTasks: NormalizedReflectionTask[] =
      tasks.map((task) => ({
        ...task,
        due_date: task.due_date
          ? dateValueToSeoulDateString(task.due_date)
          : null,
      }));

    const todaySeoul = seoulDateString();

    const done = normalizedTasks.filter(
      (task) => task.status === "done"
    );

    const delayed = normalizedTasks.filter(
      (task) =>
        task.status !== "done" &&
        task.due_date &&
        task.due_date < todaySeoul
    );

    const blockedIds = new Set(
      logs
        .filter((log) =>
          String(log.blocker_reason ?? "").trim()
        )
        .map((log) => String(log.task_id))
    );

    const blocked = normalizedTasks.filter((task) =>
      blockedIds.has(String(task.id))
    );

    const estimatedMinutes = normalizedTasks.reduce(
      (sum, task) =>
        sum + Number(task.estimated_minutes || 0),
      0
    );

    const actualMinutes = logs.reduce(
      (sum, log) =>
        sum + Number(log.actual_minutes || 0),
      0
    );

    const reflectionRows = await sql`
      SELECT r.*
      FROM reflections r
      JOIN plans p ON p.id = r.plan_id
      WHERE r.plan_id = ${planId}
        AND p.user_id = ${user.id}
      ORDER BY r.created_at DESC
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
        differenceMinutes:
          actualMinutes - estimatedMinutes,
      },
      details: {
        plan: normalizedTasks,
        done,
        delayed,
        blocked,
        estimated: normalizedTasks,
        actual: logs,
      },
      reflections: reflectionRows,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "돌아보기를 계산하지 못했습니다." },
      { status: 500 }
    );
  }
}
