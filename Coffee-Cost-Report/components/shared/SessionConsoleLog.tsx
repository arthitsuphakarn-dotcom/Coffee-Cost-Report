"use client";

import { useEffect } from "react";
import type { CprOneUser } from "@/lib/database/userSessionRepository";

/** log session ปัจจุบันลง console ของ browser (F12) — เห็นได้เฉพาะ session ของคนที่เปิดหน้านี้เอง
 *  ถ้าอยากดูว่าทุกคนเข้ามาเมื่อไหร่ ต้องดู log ฝั่ง server ([access] ใน lib/auth/session.ts) */
export default function SessionConsoleLog({ user }: { user: CprOneUser }) {
  useEffect(() => {
    const fullName = [user.title, user.name, user.surname].filter(Boolean).join(" ");

    console.log(
      `%c[session]%c เข้าใช้งานโดย ${user.username}${fullName ? ` (${fullName})` : ""} · ${new Date().toLocaleString("th-TH")}`,
      "background:#15803d;color:#fff;padding:2px 6px;border-radius:4px",
      "color:inherit"
    );

    console.table({
      username: user.username,
      title: user.title,
      name: user.name,
      surname: user.surname,
      employeeCode: user.employeeCode,
      loginMethod: user.loginMethod,
      assignedBy: user.assignedBy,
      roleId: user.roleId,
      roleAccessId: user.roleAccessId,
      status: user.status,
      edit: user.edit,
      sessionExpiresAt: user.session.expiresAt,
      sessionIpAddress: user.session.ipAddress,
      sessionUserAgent: user.session.userAgent,
    });
  }, [user]);

  return null;
}
