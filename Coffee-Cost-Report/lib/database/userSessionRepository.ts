import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { getCprOneDbPool } from "./connection";

interface SessionUserRecord extends RowDataPacket {
  U_USERNAME: string;
  U_NAME: string | null;
  U_SURNAME: string | null;
}

export interface CprOneUser {
  username: string;
  name: string;
  surname: string;
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

/** session ที่ยังไม่หมดอายุ + user ยัง active — ไม่พบคืน null */
export async function findActiveSessionUser(tokenHash: string): Promise<CprOneUser | null> {
  const [records] = await getCprOneDbPool().query<SessionUserRecord[]>(
    `
    SELECT u.U_USERNAME, u.U_NAME, u.U_SURNAME
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

  return {
    username: record.U_USERNAME,
    name: record.U_NAME ?? "",
    surname: record.U_SURNAME ?? "",
  };
}
