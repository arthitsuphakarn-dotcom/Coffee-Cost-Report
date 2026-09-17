export const CPR_ONE_SESSION_COOKIE = "cpr_one_session";

export const UNAUTHENTICATED_MESSAGE = "กรุณาเข้าสู่ระบบผ่าน CPR-one ก่อนใช้งาน";

/** proxy.ts ใส่ path ของ request ลง header นี้ให้ session.ts เอาไป log */
export const ACCESS_PATH_HEADER = "x-ccr-path";

const DEFAULT_LOGIN_URL = "https://www.cpr-one.com/cpr-one/view/auth/login.php";

export function cprOneLoginUrl(): string {
  return process.env.CPR_ONE_LOGIN_URL || DEFAULT_LOGIN_URL;
}

export function isAuthBypassed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.CPR_ONE_AUTH_BYPASS === "true";
}

/** log ว่าใครเข้ามาดูอะไร — ปิดด้วย AUTH_ACCESS_LOG=false */
export function accessLog(message: string): void {
  if (process.env.AUTH_ACCESS_LOG === "false") {
    return;
  }
  console.log(`[access] ${message}`);
}
