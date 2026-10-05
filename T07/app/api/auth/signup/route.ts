import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const loginId = String(body.loginId ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (loginId.length < 3 || loginId.length > 50) {
      return NextResponse.json(
        { ok: false, error: "아이디는 3~50자로 입력해 주세요." },
        { status: 400 }
      );
    }

    const passwordBytes = Buffer.byteLength(password, "utf8");
    if (password.length < 8 || passwordBytes > 72) {
      return NextResponse.json(
        { ok: false, error: "비밀번호는 8자 이상, UTF-8 기준 72바이트 이하로 입력해 주세요." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const sql = getSql();

    const rows = await sql`
      INSERT INTO users (login_id, password_hash)
      VALUES (${loginId}, ${passwordHash})
      RETURNING id, login_id, created_at
    `;

    const user = rows[0] as {
      id: string;
      login_id: string;
      created_at: string;
    };

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          loginId: user.login_id,
          createdAt: user.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    if (code === "23505") {
      return NextResponse.json(
        { ok: false, error: "이미 사용 중인 아이디입니다." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "가입 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}
