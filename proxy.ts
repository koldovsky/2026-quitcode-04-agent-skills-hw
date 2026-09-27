import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export function proxy(request: NextRequest) {
  // Server Actions are POSTs to the page they live on. A 307 here would re-send the action to
  // /login, where it doesn't exist ("Failed to find Server Action"), so let it through: every
  // action checks the session itself and its redirect("/login") navigates with or without JS.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
