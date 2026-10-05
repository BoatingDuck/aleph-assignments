import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const sql = getSql();

    const rows = await sql`
      SELECT *
      FROM security_checks
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    return NextResponse.json({
      ok: true,
      checks: rows,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "안전성 점검 기록을 불러오지 못했습니다.",
      },
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
    const content = String(body.content ?? "");

    if (!content) {
      return NextResponse.json(
        { ok: false, error: "점검할 글자를 입력하세요." },
        { status: 400 }
      );
    }

    const sql = getSql();

    const rows = await sql`
      INSERT INTO security_checks (user_id, content)
      VALUES (${user.id}, ${content})
      RETURNING *
    `;

    return NextResponse.json(
      { ok: true, check: rows[0] },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "안전성 점검 기록을 저장하지 못했습니다.",
      },
      { status: 500 }
    );
  }
}
