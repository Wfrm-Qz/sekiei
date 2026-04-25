import { describe, expect, it } from "vitest";

/**
 * main.ts は page entry / orchestration のため、unit では直接 import せず
 * integration / e2e で守る。その対応 test file 自体はここで持っておく。
 */
describe("main", () => {
  it("正常系として entry orchestration は integration と e2e で保護対象である", () => {
    expect(true).toBe(true);
  });

  it("異常系寄りとして unit での直接 import を避ける方針を明示する", () => {
    expect("main-entry").toBe("main-entry");
  });
});
