import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Logs every incoming request to stdout so it shows up in the container logs
 * (e.g. Portainer). Next.js does not log requests in production by default —
 * `next start` only prints the startup banner.
 *
 * Note: this logs requests that hit the Next.js server (page loads, data/RSC
 * requests, Next API routes, runtime-config). The marketplace's calls to the
 * Ocean node / aquarius bridge are made from the browser and go straight to the
 * node, so they do NOT pass through here — those appear in the node/bridge logs.
 */
export function middleware(request: NextRequest): NextResponse {
  const { method, nextUrl } = request
  const path = `${nextUrl.pathname}${nextUrl.search}`
  console.log(`[req] ${new Date().toISOString()} ${method} ${path}`)
  return NextResponse.next()
}

export const config = {
  // Run on everything except Next.js internals and static files, so the log
  // isn't flooded with asset requests. Delete this matcher to log literally
  // every request.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
