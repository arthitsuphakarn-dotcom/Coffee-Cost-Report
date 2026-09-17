import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_PATH_HEADER,
  CPR_ONE_SESSION_COOKIE,
  UNAUTHENTICATED_MESSAGE,
  cprOneLoginUrl,
  isAuthBypassed,
} from "@/lib/auth/sessionConfig";

/** ด่านแรกแบบ optimistic: ดูแค่ว่ามี cookie ของ cpr-one หรือไม่ (ไม่แตะ DB ตามคำแนะนำของ Next)
 *  การตรวจกับ user_sessions จริงอยู่ที่ lib/auth/session.ts ซึ่ง page และ route handler ทุกตัวเรียก */
export function proxy(request: NextRequest) {
  // pathname ไม่รวม basePath
  const { pathname } = request.nextUrl;

  if (isAuthBypassed() || request.cookies.has(CPR_ONE_SESSION_COOKIE)) {
    // ส่ง path ต่อให้ชั้นตรวจ session ใช้ตอน log ว่าใครเปิดอะไร
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(ACCESS_PATH_HEADER, `${request.method} ${pathname}`);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  console.warn(`[auth] ไม่มี cookie ${CPR_ONE_SESSION_COOKIE} → ส่งไป login · ${request.method} ${pathname}`);

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: UNAUTHENTICATED_MESSAGE }, { status: 401 });
  }

  return NextResponse.redirect(cprOneLoginUrl());
}

export const config = {
  // Next เติม basePath ให้ matcher เอง
  matcher: ["/", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
