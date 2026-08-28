import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { resolveProtectedPageAccess } from "@/server/auth/access-control";

export default auth((request) => {
  const user = request.auth?.user
    ? {
        id: request.auth.user.id,
        email: request.auth.user.email,
        name: request.auth.user.name ?? null,
        image: request.auth.user.image ?? null,
        role: request.auth.user.role,
      }
    : null;
  const result = resolveProtectedPageAccess(request.nextUrl.pathname, user);

  if (result.type === "redirect") {
    return NextResponse.redirect(new URL(result.location, request.nextUrl));
  }

  if (result.type === "forbidden") {
    return NextResponse.redirect(
      new URL("/internal?forbidden=1", request.nextUrl),
    );
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
});

export const config = {
  matcher: ["/internal/:path*", "/admin/:path*"],
};