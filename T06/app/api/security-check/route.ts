import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`SELECT * FROM security_checks ORDER BY created_at DESC LIMIT 10`;
    return NextResponse.json({ ok: true, checks: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "안전성 점검 기록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const content = String(body.content ?? "");
    if (!content) return NextResponse.json({ ok: false, error: "점검할 글자를 입력하세요." }, { status: 400 });
    const sql = getSql();
    const rows = await sql`INSERT INTO security_checks (content) VALUES (${content}) RETURNING *`;
    return NextResponse.json({ ok: true, check: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "안전성 점검 기록을 저장하지 못했습니다." }, { status: 500 });
  }
}
