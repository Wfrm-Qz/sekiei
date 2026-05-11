import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_DRAFT_FACE_FIELDS,
  createEmptyDraftFace,
  getDraftEmptyFields,
  isDraftFace,
} from "../../../src/state/draftFaces.ts";

/**
 * state/draftFaces の空欄下書き行 helper を確認する unit test。
 */
describe("state/draftFaces", () => {
  it("createEmptyDraftFace は正常系で空欄下書き面を作る", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("draft-uuid");

    const face = createEmptyDraftFace("cubic");

    expect(face.enabled).toBe(false);
    expect(face.draftGroupKey).toBe("draft-uuid");
    expect(face.draftEmptyFields).toEqual(EMPTY_DRAFT_FACE_FIELDS);
  });

  it("getDraftEmptyFields は未知 field を捨て、isDraftFace は null や空配列を false にする", () => {
    expect(
      getDraftEmptyFields({
        draftEmptyFields: ["h", "unknown", "distance"],
      }),
    ).toEqual(["h", "distance"]);
    expect(getDraftEmptyFields(null)).toEqual([]);
    expect(isDraftFace(null)).toBe(false);
    expect(isDraftFace({ draftEmptyFields: [] })).toBe(false);
  });
});
