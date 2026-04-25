import { describe, expect, it } from "vitest";
import {
  createDefaultTwinAxisRule,
  createDefaultTwinParameters,
  twinRuleTypeForTwinType,
} from "../../../../src/domain/parameters/defaults.ts";

describe("domain/parameters/defaults", () => {
  it("正常系として既定 parameters を base crystal 付きで返す", () => {
    const parameters = createDefaultTwinParameters();

    expect(parameters.mode).toBe("twin");
    expect(parameters.twin.crystals).toHaveLength(1);
    expect(parameters.twin.crystals[0].role).toBe("base");
    expect(parameters.faces).toEqual(parameters.twin.crystals[0].faces);
  });

  it("異常系寄りとして twin type が contact 以外なら axis rule を返す", () => {
    expect(twinRuleTypeForTwinType("contact")).toBe("plane");
    expect(twinRuleTypeForTwinType("penetration")).toBe("axis");
    expect(twinRuleTypeForTwinType("unknown")).toBe("axis");

    const trigonalRule = createDefaultTwinAxisRule("trigonal");
    expect(trigonalRule.i).toBeDefined();

    const cubicRule = createDefaultTwinAxisRule("cubic");
    expect(cubicRule.h).toBe(1);
    expect(cubicRule.k).toBe(1);
    expect(cubicRule.l).toBe(1);
  });
});
