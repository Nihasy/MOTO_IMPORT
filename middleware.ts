import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "mi_session";

/**
 * Garde d'authentification cote serveur pour /admin (12.3).
 * La verification de signature complete a lieu dans le layout : le middleware
 * s'execute sur le runtime Edge, ou `node:crypto` n'est pas disponible.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }
  const jeton = req.cookies.get(COOKIE)?.value;
  if (!jeton || jeton.split(".").length !== 2) {
    const url = req.nextUrl.clone();
    url.pathname = "/connexion";
    url.searchParams.set("suite", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
