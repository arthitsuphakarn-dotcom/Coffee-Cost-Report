import "server-only";

import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { findActiveSessionUser, type CprOneUser } from "@/lib/database/userSessionRepository";
import {
  ACCESS_PATH_HEADER,
  CPR_ONE_SESSION_COOKIE,
  UNAUTHENTICATED_MESSAGE,
  accessLog,
  cprOneLoginUrl,
  isAuthBypassed,
} from "./sessionConfig";

const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

const DEV_BYPASS_USER: CprOneUser = {
  username: "dev-bypass",
  title: "",
  name: "Dev",
  surname: "Bypass",
  employeeCode: "",
  roleId: "",
  roleAccessId: "",
  assignedBy: "",
  loginMethod: "password",
  status: "1",
  edit: "",
  session: { expiresAt: "", ipAddress: "", userAgent: "" },
};

/** "cprdev (Super Admin) emp=123 login=citrix role=1 access=2" */
function describeUser(user: CprOneUser): string {
  const fullName = [user.title, user.name, user.surname].filter(Boolean).join(" ");
  return [
    `${user.username}${fullName ? ` (${fullName})` : ""}`,
    user.employeeCode && `emp=${user.employeeCode}`,
    `login=${user.loginMethod}`,
    user.roleId && `role=${user.roleId}`,
    user.roleAccessId && `access=${user.roleAccessId}`,
  ]
    .filter(Boolean)
    .join(" ");
}

/** "POST /api/std · จาก 10.1.2.3" — path มาจาก header ที่ proxy.ts ใส่ไว้ */
async function requestInfo(): Promise<string> {
  try {
    const h = await headers();
    const path = h.get(ACCESS_PATH_HEADER) ?? "(ไม่ทราบ path)";
    const forwarded = h.get("x-forwarded-for") ?? "";
    const ip = forwarded ? forwarded.split(",")[0].trim() : "(ไม่ทราบ ip)";
    return `${path} · จาก ${ip}`;
  } catch {
    return "(อ่าน header ไม่ได้)";
  }
}

/** ตรวจ cookie cpr_one_session กับตาราง user_sessions ของ cpr-one จริง
 *  (proxy.ts ดูแค่ว่ามี cookie) — cache ไว้ต่อ request จึง query และ log ครั้งเดียว */
export const getCprOneUser = cache(async (): Promise<CprOneUser | null> => {
  if (isAuthBypassed()) {
    accessLog(`${describeUser(DEV_BYPASS_USER)} (ข้ามการตรวจในโหมด dev) · ${await requestInfo()}`);
    return DEV_BYPASS_USER;
  }

  const token = (await cookies()).get(CPR_ONE_SESSION_COOKIE)?.value;
  if (!token || !SESSION_TOKEN_PATTERN.test(token)) {
    return null;
  }

  try {
    const user = await findActiveSessionUser(createHash("sha256").update(token).digest("hex"));

    if (user) {
      accessLog(`${describeUser(user)} · ${await requestInfo()}`);
    }

    return user;
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
