import "server-only";

import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { findActiveSessionUser, type CprOneUser } from "@/lib/database/userSessionRepository";
import { CPR_ONE_SESSION_COOKIE, UNAUTHENTICATED_MESSAGE, cprOneLoginUrl, isAuthBypassed } from "./sessionConfig";

const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

const DEV_BYPASS_USER: CprOneUser = { username: "dev-bypass", name: "Dev", surname: "Bypass" };

/** ตรวจ cookie cpr_one_session กับตาราง user_sessions ของ cpr-one จริง
 *  (proxy.ts ดูแค่ว่ามี cookie) — cache ไว้ต่อ request จึง query ครั้งเดียว */
export const getCprOneUser = cache(async (): Promise<CprOneUser | null> => {
  if (isAuthBypassed()) {
    return DEV_BYPASS_USER;
  }

  const token = (await cookies()).get(CPR_ONE_SESSION_COOKIE)?.value;
  if (!token || !SESSION_TOKEN_PATTERN.test(token)) {
    return null;
  }

  try {
    return await findActiveSessionUser(createHash("sha256").update(token).digest("hex"));
  } catch (error) {
    // ตรวจไม่ได้ = ไม่ให้เข้า
    console.error("[auth] findActiveSessionUser", error);
    return null;
  }
});

/** ใช้ใน Server Component — ไม่มี session ส่งไปหน้า login ของ cpr-one */
export async function requireCprOneUser(): Promise<CprOneUser> {
  const user = await getCprOneUser();
  if (!user) {
    redirect(cprOneLoginUrl());
  }
  return user;
}

/** ใช้ใน Route Handler — ไม่มี session คืน 401, ผ่านคืน null */
export async function rejectWithoutSession(): Promise<NextResponse | null> {
  if (await getCprOneUser()) {
    return null;
  }
  return NextResponse.json({ error: UNAUTHENTICATED_MESSAGE }, { status: 401 });
}
