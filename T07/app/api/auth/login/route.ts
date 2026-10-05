import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { createSession, destroyCurrentSession, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGIN_ERROR = "아이디 또는 비밀번호가 올바르지 않습니다.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const loginId = String(body.loginId ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!loginId || !password) {
      return NextResponse.json(
        { ok: false, error: LOGIN_ERROR },
        { status: 401 }
      );
    }

    const sql = getSql();
    const rows = await sql`
      SELECT id, login_id, password_hash
      FROM users
      WHERE lower(login_id) = ${loginId}
      LIMIT 1
    `;

    const user = rows[0] as
      | { id: string; login_id: string; password_hash: string }
      | undefined;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: LOGIN_ERROR },
        { status: 401 }
      );
    }

    const passwordMatches = await verifyPassword(password, user.password_hash);

    if (!passwordMatches) {
      return NextResponse.json(
        { ok: false, error: LOGIN_ERROR },
        { status: 401 }
      );
    }

    // 이미 로그인된 브라우저에서 다시 로그인하는 경우 기존 현재 세션부터 폐기한다.
    await destroyCurrentSession();
    const expiresAt = await createSession(user.id);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        loginId: user.login_id,
      },
      session: {
        expiresAt: expiresAt.toISOString(),
        maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "로그인 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}
