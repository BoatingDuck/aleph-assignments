import { NextResponse } from "next/server";
import { getCurrentUser, destroyAllUserSessions } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    const newPasswordBytes = Buffer.byteLength(newPassword, "utf8");

    if (newPassword.length < 8 || newPasswordBytes > 72) {
      return NextResponse.json(
        {
          ok: false,
          error: "새 비밀번호는 8자 이상, UTF-8 기준 72바이트 이하로 입력해 주세요.",
        },
        { status: 400 }
      );
    }

    const sql = getSql();

    const rows = await sql`
      SELECT password_hash
      FROM users
      WHERE id = ${user.id}
      LIMIT 1
    `;

    const account = rows[0] as { password_hash?: string } | undefined;

    if (!account?.password_hash) {
      return NextResponse.json(
        { ok: false, error: "계정 정보를 확인하지 못했습니다." },
        { status: 404 }
      );
    }

    const currentMatches = await verifyPassword(
      currentPassword,
      account.password_hash
    );

    if (!currentMatches) {
      return NextResponse.json(
        { ok: false, error: "현재 비밀번호가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const sameAsCurrent = await verifyPassword(
      newPassword,
      account.password_hash
    );

    if (sameAsCurrent) {
      return NextResponse.json(
        { ok: false, error: "새 비밀번호는 현재 비밀번호와 다르게 입력해 주세요." },
        { status: 400 }
      );
    }

    const newPasswordHash = await hashPassword(newPassword);

    await sql`
      UPDATE users
      SET password_hash = ${newPasswordHash},
          updated_at = now()
      WHERE id = ${user.id}
    `;

    // 비밀번호 변경 직후 이 사용자의 기존 세션을 모두 폐기한다.
    // 현재 브라우저의 쿠키도 함께 만료되어 다시 로그인해야 한다.
    await destroyAllUserSessions(user.id);

    return NextResponse.json({
      ok: true,
      message: "비밀번호가 변경되었습니다. 다시 로그인해 주세요.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "비밀번호 변경에 실패했습니다." },
      { status: 500 }
    );
  }
}
