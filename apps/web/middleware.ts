export { auth as middleware } from "@/app/lib/auth"

export const config = {
  matcher: ["/chat/:path*"],
}
