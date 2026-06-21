import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { applyMetadataDraftPatch } from "../src/lib/upload-metadata-sync-mode"

const baseDraft = {
  caption: "Caption A",
  keywords: "Keywords A",
  whoIsInPicture: "Person A",
}

describe("upload metadata sync mode helpers", () => {
  it("merges only the patched field when sync mode is off", () => {
    const next = applyMetadataDraftPatch({
      syncMode: false,
      current: baseDraft,
      patch: { keywords: "New keywords" },
    })
    assert.deepEqual(next, {
      caption: "Caption A",
      keywords: "New keywords",
      whoIsInPicture: "Person A",
    })
  })

  it("mirrors who is in picture to all fields when sync mode is on", () => {
    const next = applyMetadataDraftPatch({
      syncMode: true,
      current: baseDraft,
      patch: { whoIsInPicture: "Rahul Sharma" },
    })
    assert.deepEqual(next, {
      caption: "Rahul Sharma",
      keywords: "Rahul Sharma",
      whoIsInPicture: "Rahul Sharma",
    })
  })

  it("mirrors keywords to all fields when sync mode is on", () => {
    const next = applyMetadataDraftPatch({
      syncMode: true,
      current: baseDraft,
      patch: { keywords: "IPL, cricket" },
    })
    assert.deepEqual(next, {
      caption: "IPL, cricket",
      keywords: "IPL, cricket",
      whoIsInPicture: "IPL, cricket",
    })
  })

  it("mirrors caption to all fields when sync mode is on", () => {
    const next = applyMetadataDraftPatch({
      syncMode: true,
      current: baseDraft,
      patch: { caption: "Match day photo" },
    })
    assert.deepEqual(next, {
      caption: "Match day photo",
      keywords: "Match day photo",
      whoIsInPicture: "Match day photo",
    })
  })

  it("overwrites differing field values when sync mode is on", () => {
    const next = applyMetadataDraftPatch({
      syncMode: true,
      current: {
        caption: "Old caption",
        keywords: "Old keywords",
        whoIsInPicture: "Old person",
      },
      patch: { caption: "Unified value" },
    })
    assert.deepEqual(next, {
      caption: "Unified value",
      keywords: "Unified value",
      whoIsInPicture: "Unified value",
    })
  })
})
