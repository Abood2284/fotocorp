import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildUnifiedSessionFromPlatform,
  buildUnifiedSessionFromStaff,
} from "../src/lib/auth-session-build"

describe("auth-session-build", () => {
  it("builds contributor session", () => {
    const session = buildUnifiedSessionFromPlatform({
      ownerType: "CONTRIBUTOR",
      contributor: {
        id: "c1",
        displayName: "Ada Contributor",
        username: "ada",
        email: "ada@studio.test",
      },
    })

    assert.equal(session?.kind, "contributor")
    assert.equal(session?.primaryHref, "/contributor/dashboard")
    assert.equal(session?.contributor?.username, "ada")
  })

  it("builds user session", () => {
    const session = buildUnifiedSessionFromPlatform({
      ownerType: "USER",
      user: {
        id: "u1",
        email: "reader@corp.test",
        displayName: "Ada Reader",
      },
    })

    assert.equal(session?.kind, "user")
    assert.equal(session?.primaryHref, "/account/fotobox")
    assert.equal(session?.user?.email, "reader@corp.test")
  })

  it("builds staff session", () => {
    const session = buildUnifiedSessionFromStaff({
      staff: {
        id: "s1",
        username: "ops",
        displayName: "Ops User",
        role: "SUPER_ADMIN",
      },
    })

    assert.equal(session.kind, "staff")
    assert.equal(session.primaryHref, "/staff/dashboard")
  })
})
