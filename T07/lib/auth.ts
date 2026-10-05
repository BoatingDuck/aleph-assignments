import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getSql } from "@/lib/db";

export const SESSION_COOKIE_NAME = "t07_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24시간

export type AuthUser = {
  id: string;
  loginId: string;
};

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const sql = getSql();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await sql`
    DELETE FROM sessions
    WHERE user_id = ${userId}
      AND expires_at <= now()
  `;

  await sql`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt.toISOString()})
  `;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return expiresAt;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  const sql = getSql();
  const tokenHash = hashSessionToken(token);

  const rows = await sql`
    SELECT u.id, u.login_id
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
      AND s.expires_at > now()
    LIMIT 1
  `;

  const row = rows[0] as { id?: string; login_id?: string } | undefined;

  if (!row?.id || !row.login_id) {
    cookieStore.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0),
    });
    return null;
  }

  return {
    id: String(row.id),
    loginId: String(row.login_id),
  };
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const sql = getSql();
    const tokenHash = hashSessionToken(token);

    await sql`
      DELETE FROM sessions
      WHERE token_hash = ${tokenHash}
    `;
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function destroyAllUserSessions(userId: string) {
  const sql = getSql();
  await sql`
    DELETE FROM sessions
    WHERE user_id = ${userId}
  `;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}
