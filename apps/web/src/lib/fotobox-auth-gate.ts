import { buildSignInHref } from "@/lib/auth-sign-in-gateway"

export function buildFotoboxAuthHref(callbackUrl: string) {
  return buildSignInHref({ callbackUrl })
}

export function buildFotoboxAuthPathname(pathname: string, search = "") {
  const callbackUrl = search ? `${pathname}?${search}` : pathname
  return buildFotoboxAuthHref(callbackUrl)
}
