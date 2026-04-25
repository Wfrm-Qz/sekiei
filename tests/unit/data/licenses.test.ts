import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT_DIR = resolve(import.meta.dirname, "../../..");
const NODE_MODULES_DIR = resolve(ROOT_DIR, "node_modules");

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("third-party license inventory", () => {
  it("tracks expected licenses for direct runtime dependencies", () => {
    const expected = {
      three: "MIT",
      "three-bvh-csg": "MIT",
      "three-mesh-bvh": "MIT",
      "@jscad/modeling": "MIT",
    } as const;

    Object.entries(expected).forEach(([pkgName, license]) => {
      const pkgPath = resolve(
        NODE_MODULES_DIR,
        ...pkgName.split("/"),
        "package.json",
      );
      const pkg = readJson(pkgPath);
      expect(pkg.license).toBe(license);
    });
  });

  it("tracks expected licenses for major development tools", () => {
    const expected = {
      vite: "MIT",
      vitest: "MIT",
      prettier: "MIT",
      eslint: "MIT",
      stylelint: "MIT",
      "html-validate": "MIT",
      "@playwright/test": "Apache-2.0",
      typescript: "Apache-2.0",
    } as const;

    Object.entries(expected).forEach(([pkgName, license]) => {
      const pkgPath = resolve(
        NODE_MODULES_DIR,
        ...pkgName.split("/"),
        "package.json",
      );
      const pkg = readJson(pkgPath);
      expect(pkg.license).toBe(license);
    });
  });

  it("keeps bundled font license texts alongside distributed font files", () => {
    const files = [
      "assets/fonts/helvetiker_regular.typeface.json",
      "assets/fonts/optimer_regular.typeface.json",
      "assets/fonts/gentilis_regular.typeface.json",
      "assets/fonts/Sora-wght.ttf",
      "assets/fonts/LICENSE-MgOpen.txt",
      "assets/fonts/LICENSE-Gentilis-OFL-1.1.txt",
      "assets/fonts/LICENSE-Sora-OFL-1.1.txt",
    ];

    files.forEach((relativePath) => {
      expect(existsSync(resolve(ROOT_DIR, relativePath))).toBe(true);
    });
  });
});
