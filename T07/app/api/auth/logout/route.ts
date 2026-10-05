import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await destroyCurrentSession();

    return NextResponse.json({
      ok: true,
      message: "로그아웃되었습니다.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "로그아웃 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}
