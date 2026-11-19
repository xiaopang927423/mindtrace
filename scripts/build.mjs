import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("out", { recursive: true });
await Promise.all([
  build({
    entryPoints: ["Web/app.ts"],
    bundle: true,
    format: "iife",
    target: "chrome140",
    outfile: "Web/app.bundle.js",
    sourcemap: false,
  }),
  build({
    entryPoints: ["electron/main.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node24",
    outfile: "out/main.cjs",
    external: ["electron", "pdfjs-dist/*", "linkedom"],
  }),
  build({
    entryPoints: ["electron/preload.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node24",
    outfile: "out/preload.cjs",
    external: ["electron"],
  }),
]);
console.log("TypeScript desktop and renderer built.");
