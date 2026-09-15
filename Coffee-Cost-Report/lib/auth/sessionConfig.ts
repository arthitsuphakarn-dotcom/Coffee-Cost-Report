
export const CPR_ONE_SESSION_COOKIE = "cpr_one_session";

export const UNAUTHENTICATED_MESSAGE = "กรุณาเข้าสู่ระบบผ่าน CPR-one ก่อนใช้งาน";

const DEFAULT_LOGIN_URL = "https://www.cpr-one.com/cpr-one/view/auth/login.php";

export function cprOneLoginUrl(): string {
  return process.env.CPR_ONE_LOGIN_URL || DEFAULT_LOGIN_URL;
}

export function isAuthBypassed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.CPR_ONE_AUTH_BYPASS === "true";
}
