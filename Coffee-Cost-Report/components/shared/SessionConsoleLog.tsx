"use client";

import { useEffect } from "react";

interface SessionConsoleLogProps {
  username: string;
  fullName: string;
}

/** log session ปัจจุบันลง console ของ browser (F12) — เห็นได้เฉพาะ session ของคนที่เปิดหน้านี้เอง
 *  ถ้าอยากดูว่าทุกคนเข้ามาเมื่อไหร่ ต้องดู log ฝั่ง server ([access] ใน lib/auth/session.ts) */
export default function SessionConsoleLog({ username, fullName }: SessionConsoleLogProps) {
  useEffect(() => {
    console.log(
      `%c[session]%c เข้าใช้งานโดย ${username}${fullName ? ` (${fullName})` : ""} · ${new Date().toLocaleString("th-TH")}`,
      "background:#15803d;color:#fff;padding:2px 6px;border-radius:4px",
      "color:inherit"
    );
  }, [username, fullName]);

  return null;
}
