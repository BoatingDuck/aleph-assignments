import { NextResponse } from "next/server";
import { getCurrentUser, destroyAllUserSessions } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const password = String(body?.password ?? "");
    if (!password) {
      return NextResponse.json({ ok: false, error: "현재 비밀번호를 입력하세요." }, { status: 400 });
    }

    const sql = getSql();
    const userRows = await sql`
      SELECT password_hash
      FROM users
      WHERE id = ${user.id}
      LIMIT 1
    `;
    const passwordHash = String(userRows[0]?.password_hash ?? "");

    if (!passwordHash || !(await verifyPassword(password, passwordHash))) {
      return NextResponse.json({ ok: false, error: "현재 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    await sql`
      DELETE FROM idempotency_keys
      WHERE key IN (
        SELECT tc.idempotency_key
        FROM task_completions tc
        JOIN tasks t ON t.id = tc.task_id
        JOIN plans p ON p.id = t.plan_id
        WHERE p.user_id = ${user.id}
      )
    `;

    await sql`DELETE FROM users WHERE id = ${user.id}`;
    await destroyAllUserSessions(user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("delete-account failed", error);
    return NextResponse.json({ ok: false, error: "계정 삭제에 실패했습니다." }, { status: 500 });
  }
}
