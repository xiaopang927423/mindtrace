import { chromium } from "@playwright/test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const dir = "assets/AppIcon.iconset";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: 1024, height: 1024 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>body{margin:0;background:transparent}</style>${await readFile("assets/icon.svg", "utf8")}`,
  );
  await page.screenshot({
    path: `${dir}/icon_512x512@2x.png`,
    omitBackground: true,
  });
} finally {
  await browser.close();
}
for (const size of [16, 32, 128, 256, 512])
  for (const scale of [1, 2]) {
    if (size === 512 && scale === 2) continue;
    execFileSync(
      "sips",
      [
        "-z",
        String(size * scale),
        String(size * scale),
        `${dir}/icon_512x512@2x.png`,
        "--out",
        `${dir}/icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`,
      ],
      { stdio: "ignore" },
    );
  }
execFileSync("iconutil", ["-c", "icns", dir, "-o", "assets/AppIcon.icns"]);
await rm(dir, { recursive: true, force: true });
