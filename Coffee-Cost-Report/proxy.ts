import { NextResponse, type NextRequest } from "next/server";
import { CPR_ONE_SESSION_COOKIE, UNAUTHENTICATED_MESSAGE, cprOneLoginUrl, isAuthBypassed } from "@/lib/auth/sessionConfig";

/** ด่านแรกแบบ optimistic: ดูแค่ว่ามี cookie ของ cpr-one หรือไม่ (ไม่แตะ DB ตามคำแนะนำของ Next)
 *  การตรวจกับ user_sessions จริงอยู่ที่ lib/auth/session.ts ซึ่ง page และ route handler ทุกตัวเรียก */
export function proxy(request: NextRequest) {
  if (isAuthBypassed() || request.cookies.has(CPR_ONE_SESSION_COOKIE)) {
    return NextResponse.next();
  }

  // pathname ไม่รวม basePath
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: UNAUTHENTICATED_MESSAGE }, { status: 401 });
  }

  return NextResponse.redirect(cprOneLoginUrl());
}

export const config = {
  // Next เติม basePath ให้ matcher เอง
  matcher: ["/", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
