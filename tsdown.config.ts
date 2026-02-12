import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/client.ts"],
  outDir: "dist",
  format: ["esm"],
  dts: { build: true, incremental: true },
  sourcemap: true,
  treeshake: true,
  clean: true,
  unbundle: true,
});
