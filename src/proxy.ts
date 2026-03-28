import { NextResponse, type NextRequest } from "next/server";

function getCanonicalUrl() {
  const value = process.env.AUTH_URL;
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.next();
  }

  const canonicalUrl = getCanonicalUrl();
  if (!canonicalUrl) {
    return NextResponse.next();
  }

  const requestUrl = request.nextUrl;
  if (requestUrl.hostname === canonicalUrl.hostname) {
    return NextResponse.next();
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    return NextResponse.next();
  }

  const redirectUrl = new URL(requestUrl.pathname + requestUrl.search, canonicalUrl);
  return NextResponse.redirect(redirectUrl, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
