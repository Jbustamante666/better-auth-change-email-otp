import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/client.ts",
  ],
  outDir: "dist",
  format: ["module"],
  dts: true,
  minify: true,
  clean: true,
});
