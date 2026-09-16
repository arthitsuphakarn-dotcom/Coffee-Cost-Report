import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { getCprOneDbPool } from "./connection";

type DbValue = string | number | null;

interface SessionUserRecord extends RowDataPacket {
  U_USERNAME: string;
  U_TITLE: DbValue;
  U_NAME: DbValue;
  U_SURNAME: DbValue;
  U_EMPLOYEE_CODE: DbValue;
  U_ROLE_ID: DbValue;
  U_ROLE_ACCESS_ID: DbValue;
  U_ASSIGNED_BY: DbValue;
  U_UNDER_PM: DbValue;
  STATUS: DbValue;
  EDIT: DbValue;
  expires_at: string;
  ip_address: DbValue;
  user_agent: DbValue;
}

/** ข้อมูลผู้ใช้จาก cpr_one — ทุกคอลัมน์ของ u_user ยกเว้น U_PASSWORD + ข้อมูล session ตอน login */
export interface CprOneUser {
  username: string;
  title: string;
  name: string;
  surname: string;
  /** มีเฉพาะคนที่ login ผ่าน Citrix (authenticate.php อัปเดตจาก Cognito) */
  employeeCode: string;
  roleId: string;
  roleAccessId: string;
  /** "cognito" = บัญชีที่สร้างจากการ login ผ่าน Citrix */
  assignedBy: string;
  loginMethod: "citrix" | "password";
  underPm: string;
  status: string;
  edit: string;
  session: {
    expiresAt: string;
    ipAddress: string;
    userAgent: string;
  };
}

const bangkokDateTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** authenticate.php เขียน expires_at ด้วย date() ของ PHP (Asia/Bangkok)
 *  จึงเทียบด้วยเวลาไทยแบบเดียวกัน แทน NOW() ที่ขึ้นกับ time_zone ของ MySQL */
function bangkokNow(): string {
  return bangkokDateTime.format(new Date());
}

function text(value: DbValue): string {
  return value === null || value === undefined ? "" : String(value);
}

/** session ที่ยังไม่หมดอายุ + user ยัง active — ไม่พบคืน null
 *  ระบุคอลัมน์ทีละตัว ห้ามใช้ SELECT * เพราะจะติด U_PASSWORD มาด้วย */
export async function findActiveSessionUser(tokenHash: string): Promise<CprOneUser | null> {
  const [records] = await getCprOneDbPool().query<SessionUserRecord[]>(
    `
    SELECT u.U_USERNAME, u.U_TITLE, u.U_NAME, u.U_SURNAME, u.U_EMPLOYEE_CODE,
           u.U_ROLE_ID, u.U_ROLE_ACCESS_ID, u.U_ASSIGNED_BY, u.U_UNDER_PM, u.STATUS, u.EDIT,
           DATE_FORMAT(s.expires_at, '%Y-%m-%d %H:%i:%s') AS expires_at,
           s.ip_address, s.user_agent
    FROM user_sessions s
    JOIN u_user u ON u.U_USERNAME = s.u_username
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.STATUS = '1'
    LIMIT 1
    `,
    [tokenHash, bangkokNow()]
  );

  const record = records[0];
  if (!record) {
    return null;
  }

  const assignedBy = text(record.U_ASSIGNED_BY);

  return {
    username: record.U_USERNAME,
    title: text(record.U_TITLE),
    name: text(record.U_NAME),
    surname: text(record.U_SURNAME),
    employeeCode: text(record.U_EMPLOYEE_CODE),
    roleId: text(record.U_ROLE_ID),
    roleAccessId: text(record.U_ROLE_ACCESS_ID),
    assignedBy,
    loginMethod: assignedBy === "cognito" ? "citrix" : "password",
    underPm: text(record.U_UNDER_PM),
    status: text(record.STATUS),
    edit: text(record.EDIT),
    session: {
      expiresAt: record.expires_at,
      ipAddress: text(record.ip_address),
      userAgent: text(record.user_agent),
    },
  };
}
