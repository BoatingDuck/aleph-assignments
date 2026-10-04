import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { asNonNegativeInt, cleanTags, dateValueToSeoulDateString, priorityRank, type Priority } from "@/lib/pds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown) {
  return String(value ?? "").toLowerCase();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("planId");
    if (!planId) return NextResponse.json({ ok: false, error: "planId가 필요합니다." }, { status: 400 });

    const sql = getSql();
    let tasks = [...await sql`
      SELECT * FROM tasks
      WHERE plan_id = ${planId} AND deleted_at IS NULL
    `] as Array<Record<string, any>>;

    const q = (searchParams.get("q") ?? "").trim().toLowerCase();
    const status = searchParams.get("status") ?? "all";
    const priority = searchParams.get("priority") ?? "all";
    const tag = (searchParams.get("tag") ?? "").trim().toLowerCase();
    const sort = searchParams.get("sort") ?? "default";

    if (q) tasks = tasks.filter((task) => text(task.title).includes(q) || (task.tags ?? []).some((item: string) => item.toLowerCase().includes(q)));
    if (["todo", "doing", "done"].includes(status)) tasks = tasks.filter((task) => task.status === status);
    if (["low", "medium", "high"].includes(priority)) tasks = tasks.filter((task) => task.priority === priority);
    if (tag) tasks = tasks.filter((task) => (task.tags ?? []).some((item: string) => item.toLowerCase() === tag));

    const byCreated = (a: Record<string, any>, b: Record<string, any>) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return diff || String(a.id).localeCompare(String(b.id));
    };

    tasks.sort((a, b) => {
      if (sort === "priority") {
        const diff = priorityRank[b.priority as Priority] - priorityRank[a.priority as Priority];
        return diff || byCreated(a, b);
      }
      if (sort === "estimated") {
        const diff = Number(b.estimated_minutes) - Number(a.estimated_minutes);
        return diff || byCreated(a, b);
      }
      if (sort === "created") return byCreated(a, b);

      const aDue = a.due_date ? dateValueToSeoulDateString(a.due_date) : "9999-12-31";
      const bDue = b.due_date ? dateValueToSeoulDateString(b.due_date) : "9999-12-31";
      const dueDiff = aDue.localeCompare(bDue);
      const priorityDiff = priorityRank[b.priority as Priority] - priorityRank[a.priority as Priority];
      return dueDiff || priorityDiff || byCreated(a, b);
    });

    return NextResponse.json({ ok: true, tasks, sortRule: sort });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "할 일을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const planId = String(body.planId ?? "");
    const title = String(body.title ?? "").trim();
    const dueDate = body.dueDate ? String(body.dueDate) : null;
    const priority = ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium";
    const tags = cleanTags(body.tags);
    const estimatedMinutes = asNonNegativeInt(body.estimatedMinutes);

    if (!planId || !title) return NextResponse.json({ ok: false, error: "계획과 할 일 내용이 필요합니다." }, { status: 400 });

    const sql = getSql();
    const rows = await sql`
      INSERT INTO tasks (plan_id, title, due_date, priority, tags, estimated_minutes)
      VALUES (${planId}, ${title}, ${dueDate}, ${priority}, ${tags}, ${estimatedMinutes})
      RETURNING *
    `;
    return NextResponse.json({ ok: true, task: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "할 일을 저장하지 못했습니다." }, { status: 500 });
  }
}
