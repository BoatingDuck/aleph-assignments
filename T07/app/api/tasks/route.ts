import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import {
  asNonNegativeInt,
  cleanTags,
  dateValueToSeoulDateString,
  priorityRank,
  type Priority,
} from "@/lib/pds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TaskRow = {
  id: string;
  title: string;
  tags: string[] | null;
  status: string;
  priority: Priority;
  created_at: string | Date;
  estimated_minutes: number | string | null;
  due_date: unknown;
  [key: string]: unknown;
};

function text(value: unknown) {
  return String(value ?? "").toLowerCase();
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("planId");

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

    let tasks = [
      ...(await sql`
        SELECT t.*
        FROM tasks t
        JOIN plans p ON p.id = t.plan_id
        WHERE t.plan_id = ${planId}
          AND p.user_id = ${user.id}
          AND t.deleted_at IS NULL
      `),
    ] as TaskRow[];

    const q = (searchParams.get("q") ?? "").trim().toLowerCase();
    const status = searchParams.get("status") ?? "all";
    const priority = searchParams.get("priority") ?? "all";
    const tag = (searchParams.get("tag") ?? "").trim().toLowerCase();
    const sort = searchParams.get("sort") ?? "default";

    if (q) {
      tasks = tasks.filter(
        (task) =>
          text(task.title).includes(q) ||
          (task.tags ?? []).some((item: string) =>
            item.toLowerCase().includes(q)
          )
      );
    }

    if (["todo", "doing", "done"].includes(status)) {
      tasks = tasks.filter((task) => task.status === status);
    }

    if (["low", "medium", "high"].includes(priority)) {
      tasks = tasks.filter((task) => task.priority === priority);
    }

    if (tag) {
      tasks = tasks.filter((task) =>
        (task.tags ?? []).some(
          (item: string) => item.toLowerCase() === tag
        )
      );
    }

    const byCreated = (
      a: TaskRow,
      b: TaskRow
    ) => {
      const diff =
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime();

      return diff || String(a.id).localeCompare(String(b.id));
    };

    tasks.sort((a, b) => {
      if (sort === "priority") {
        const diff =
          priorityRank[b.priority as Priority] -
          priorityRank[a.priority as Priority];

        return diff || byCreated(a, b);
      }

      if (sort === "estimated") {
        const diff =
          Number(b.estimated_minutes) -
          Number(a.estimated_minutes);

        return diff || byCreated(a, b);
      }

      if (sort === "created") return byCreated(a, b);

      const aDue = a.due_date
        ? dateValueToSeoulDateString(a.due_date)
        : "9999-12-31";

      const bDue = b.due_date
        ? dateValueToSeoulDateString(b.due_date)
        : "9999-12-31";

      const dueDiff = aDue.localeCompare(bDue);

      const priorityDiff =
        priorityRank[b.priority as Priority] -
        priorityRank[a.priority as Priority];

      return dueDiff || priorityDiff || byCreated(a, b);
    });

    return NextResponse.json({
      ok: true,
      tasks,
      sortRule: sort,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "할 일을 불러오지 못했습니다." },
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
    const planId = String(body.planId ?? "");
    const title = String(body.title ?? "").trim();
    const dueDate = body.dueDate ? String(body.dueDate) : null;
    const priority = ["low", "medium", "high"].includes(body.priority)
      ? body.priority
      : "medium";
    const tags = cleanTags(body.tags);
    const estimatedMinutes = asNonNegativeInt(body.estimatedMinutes);

    if (!planId || !title) {
      return NextResponse.json(
        { ok: false, error: "계획과 할 일 내용이 필요합니다." },
        { status: 400 }
      );
    }

    const sql = getSql();

    const rows = await sql`
      INSERT INTO tasks (
        plan_id,
        title,
        due_date,
        priority,
        tags,
        estimated_minutes
      )
      SELECT
        p.id,
        ${title},
        ${dueDate},
        ${priority},
        ${tags},
        ${estimatedMinutes}
      FROM plans p
      WHERE p.id = ${planId}
        AND p.user_id = ${user.id}
      RETURNING *
    `;

    if (!rows[0]) {
      return NextResponse.json(
        { ok: false, error: "계획을 찾지 못했습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ok: true, task: rows[0] },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "할 일을 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}
