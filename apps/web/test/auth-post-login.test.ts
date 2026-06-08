import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ACCESS_PENDING_PATH,
  CONTRIBUTOR_DASHBOARD_PATH,
  isSafeContributorCallback,
  isSafeStaffCallback,
  isSafeSubscriberCallback,
  resolvePlatformPostLoginRedirect,
  resolveStaffPostLoginRedirectFromSignIn,
  resolveSignedInPageRedirect,
} from "../src/lib/auth-post-login"

describe("auth-post-login redirects", () => {
  it("contributor always defaults to dashboard", () => {
    assert.equal(resolvePlatformPostLoginRedirect("CONTRIBUTOR", null), CONTRIBUTOR_DASHBOARD_PATH)
    assert.equal(resolvePlatformPostLoginRedirect("CONTRIBUTOR", "/"), CONTRIBUTOR_DASHBOARD_PATH)
    assert.equal(
      resolvePlatformPostLoginRedirect("CONTRIBUTOR", "/contributor/uploads"),
      "/contributor/uploads",
    )
  })

  it("subscriber honors safe callback only", () => {
    assert.equal(resolvePlatformPostLoginRedirect("USER", null), "/")
    assert.equal(resolvePlatformPostLoginRedirect("USER", "/account/fotobox"), "/account/fotobox")
    assert.equal(resolvePlatformPostLoginRedirect("USER", "/staff/dashboard"), "/")
    assert.equal(resolvePlatformPostLoginRedirect("USER", "//evil"), "/")
  })

  it("pending access inquiry routes to access-pending", () => {
    assert.equal(
      resolvePlatformPostLoginRedirect("USER", null, { accessInquiryStatus: "PENDING" }),
      ACCESS_PENDING_PATH,
    )
    assert.equal(
      resolvePlatformPostLoginRedirect("USER", "/search", { accessInquiryStatus: "IN_REVIEW" }),
      ACCESS_PENDING_PATH,
    )
    assert.equal(
      resolvePlatformPostLoginRedirect("USER", null, { accessInquiryStatus: "ACCESS_GRANTED" }),
      "/",
    )
  })

  it("callback safety helpers", () => {
    assert.equal(isSafeSubscriberCallback("/search"), true)
    assert.equal(isSafeSubscriberCallback("/contributor/dashboard"), false)
    assert.equal(isSafeContributorCallback("/contributor/dashboard"), true)
    assert.equal(isSafeStaffCallback("/staff/catalog"), true)
  })

  it("staff sign-in defaults to homepage", () => {
    assert.equal(resolveStaffPostLoginRedirectFromSignIn("SUPER_ADMIN", null), "/")
    assert.equal(
      resolveStaffPostLoginRedirectFromSignIn("SUPER_ADMIN", "/staff/contributor-uploads"),
      "/staff/contributor-uploads",
    )
    assert.equal(resolveStaffPostLoginRedirectFromSignIn("SUPPORT", "/staff/catalog"), "/")
  })

  it("caption writer staff sign-in stays in workspace", () => {
    assert.equal(resolveStaffPostLoginRedirectFromSignIn("CAPTION_WRITER", null), "/staff/contributor-uploads")
    assert.equal(resolveStaffPostLoginRedirectFromSignIn("CAPTION_WRITER", "/"), "/staff/contributor-uploads")
    assert.equal(
      resolveStaffPostLoginRedirectFromSignIn("CAPTION_WRITER", "/staff/captions"),
      "/staff/captions",
    )
    assert.equal(
      resolveSignedInPageRedirect({
        kind: "staff",
        staffRole: "CAPTION_WRITER",
        callbackUrl: null,
      }),
      "/staff/contributor-uploads",
    )
  })

  it("resolveSignedInPageRedirect maps kinds", () => {
    assert.equal(
      resolveSignedInPageRedirect({ kind: "contributor", callbackUrl: null }),
      CONTRIBUTOR_DASHBOARD_PATH,
    )
    assert.equal(resolveSignedInPageRedirect({ kind: "user", callbackUrl: "/search" }), "/search")
    assert.equal(
      resolveSignedInPageRedirect({
        kind: "user",
        callbackUrl: "/search",
        accessInquiryStatus: "PENDING",
      }),
      ACCESS_PENDING_PATH,
    )
    assert.equal(
      resolveSignedInPageRedirect({
        kind: "staff",
        staffRole: "SUPER_ADMIN",
        callbackUrl: null,
      }),
      "/",
    )
  })
})
