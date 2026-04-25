import { defineConfig } from "vite";

/**
 * Vite の build entry を定義する。
 *
 * 正式版ページは `index.html` だけなので、build entry も 1 つに絞る。
 */

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (id.includes("three-bvh-csg") || id.includes("three-mesh-bvh")) {
            return "three-csg";
          }
          if (
            id.includes("three/addons/controls/") ||
            id.includes("three/examples/jsm/controls/")
          ) {
            return "three-controls";
          }
          if (
            id.includes("three/addons/lines/") ||
            id.includes("three/examples/jsm/lines/")
          ) {
            return "three-lines";
          }
          if (
            id.includes("three/addons/loaders/FontLoader") ||
            id.includes("three/examples/jsm/loaders/FontLoader")
          ) {
            return "three-text";
          }
          if (
            id.includes("three/addons/exporters/") ||
            id.includes("three/examples/jsm/exporters/") ||
            id.includes("three/examples/jsm/utils/BufferGeometryUtils.js")
          ) {
            return "three-exporters";
          }
          if (
            id.includes("three/addons") ||
            id.includes("three/examples/jsm")
          ) {
            return "three-shared";
          }
          if (
            id.includes("\\three\\") ||
            id.includes("/three/")
          ) {
            return "three-core";
          }
          return "vendor";
        },
      },
    },
  },
});
