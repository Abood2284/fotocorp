import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildAuthProxyRequestHeaders,
  buildAuthProxyResponseHeaders,
  isUpstreamUnreachableFetchError,
} from "../src/app/api/auth/[...all]/route"

describe("auth proxy headers", () => {
  it("does not forward body transport headers upstream", () => {
    const headers = buildAuthProxyRequestHeaders(new Headers({
      "accept": "application/json",
      "accept-encoding": "gzip, deflate",
      "connection": "keep-alive",
      "content-length": "123",
      "content-type": "application/json",
      "host": "localhost:3000",
      "transfer-encoding": "chunked",
    }))

    assert.equal(headers.get("accept"), "application/json")
    assert.equal(headers.get("content-type"), "application/json")
    assert.equal(headers.has("accept-encoding"), false)
    assert.equal(headers.has("connection"), false)
    assert.equal(headers.has("content-length"), false)
    assert.equal(headers.has("host"), false)
    assert.equal(headers.has("transfer-encoding"), false)
  })

  it("does not forward stale decoded-body headers downstream", () => {
    const headers = buildAuthProxyResponseHeaders(new Headers({
      "cache-control": "no-store",
      "connection": "keep-alive",
      "content-encoding": "gzip",
      "content-length": "121",
      "content-type": "application/json",
      "keep-alive": "timeout=5",
      "transfer-encoding": "chunked",
      "x-request-id": "request-id",
    }))

    assert.equal(headers.get("cache-control"), "no-store")
    assert.equal(headers.get("content-type"), "application/json")
    assert.equal(headers.get("x-request-id"), "request-id")
    assert.equal(headers.has("connection"), false)
    assert.equal(headers.has("content-encoding"), false)
    assert.equal(headers.has("content-length"), false)
    assert.equal(headers.has("keep-alive"), false)
    assert.equal(headers.has("transfer-encoding"), false)
  })
})

describe("isUpstreamUnreachableFetchError", () => {
  it("detects ECONNREFUSED on nested cause", () => {
    const err = new TypeError("fetch failed")
    Object.assign(err, { cause: Object.assign(new Error("connect"), { code: "ECONNREFUSED" }) })
    assert.equal(isUpstreamUnreachableFetchError(err), true)
  })

  it("detects ECONNREFUSED inside AggregateError-style errors array", () => {
    const inner = Object.assign(new Error("refused"), { code: "ECONNREFUSED" })
    const aggregate = new AggregateError([inner], "aggregate")
    const err = new TypeError("fetch failed")
    Object.assign(err, { cause: aggregate })
    assert.equal(isUpstreamUnreachableFetchError(err), true)
  })

  it("returns false for unrelated errors", () => {
    assert.equal(isUpstreamUnreachableFetchError(new Error("boom")), false)
    assert.equal(isUpstreamUnreachableFetchError(null), false)
  })
})
