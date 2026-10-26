import { NextResponse } from "next/server";
import { auth } from "./auth";

export default auth((request) => {
  if (!request.auth) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
});
export const config = { matcher: ["/admin/:path*"] };
