import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createServer } from "node:http";

const root = await mkdtemp(path.join(os.tmpdir(), "mindtrace-ui-"));
await mkdir("test-results", { recursive: true });
const env = { ...process.env, MINDTRACE_DATA_DIR: root };
delete env.ELECTRON_RUN_AS_NODE;
const errors = [];
let app,
  page,
  requests = 0;
const server = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  requests++;
  res.setHeader("Content-Type", "application/json");
  const result = {
    choices: [
      {
        finish_reason: "stop",
        message: {
          content: JSON.stringify({
            cards: [
              {
                title: "AI 建议甲",
                body: "这是测试服务返回的待验证想法",
                assumptions: "待验证假设",
              },
              { title: "AI 建议乙", body: "第二个想法" },
            ],
          }),
        },
      },
    ],
  };
  if (body.includes("测试取消"))
    setTimeout(() => res.end(JSON.stringify(result)), 2500);
  else res.end(JSON.stringify(result));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
function makePDF() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const content =
    "BT /F1 18 Tf 50 700 Td (Evidence source for MindTrace) Tj ET";
  objects.push(
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  );
  let pdf = "%PDF-1.4\n",
    offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}
async function launch() {
  app = await electron.launch({
    ...(process.env.MINDTRACE_APP_EXECUTABLE
      ? { executablePath: process.env.MINDTRACE_APP_EXECUTABLE }
      : {}),
    args: process.env.MINDTRACE_APP_EXECUTABLE ? [] : [path.resolve(".")],
    env,
    timeout: 60000,
  });
  page = await app.firstWindow();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForSelector(".app-shell", { timeout: 30000 });
}
async function click(action) {
  if (
    ["child", "confirm-card", "show-details"].includes(action) &&
    (await page.locator(`.editing [data-action="${action}"]`).count())
  ) {
    await page.locator(`.editing [data-action="${action}"]`).first().click();
    return;
  }
  await page.locator(`[data-action="${action}"]`).first().click();
}
try {
  await launch();
  await expect(page.locator(".node")).toHaveCount(7);
  await expect(page.locator(".inspector")).toHaveCount(0);
  await page.screenshot({ path: "test-results/desktop-initial.png" });
  console.log("PASS native launch / initial graph");
  await page.locator(".node.idea .node-title").first().click();
  await expect(page.locator("#inline-title")).toBeFocused();
  const editingId = await page
    .locator(".node.editing")
    .getAttribute("data-node");
  const editedNode = page.locator(`[data-node="${editingId}"]`);
  const beforeText = await editedNode.getAttribute("style");
  const content =
    "直接在卡片上填写想法，保留判断与决策的理由。\n第二行支持换行。";
  await page.locator("#inline-body").fill(content);
  await expect(page.locator(".node.judgment .card-confirm-state")).toHaveText(
    "待复核",
  );
  await page.locator("#inline-body").press("End");
  await page.keyboard.insertText(" undo-me");
  await page.keyboard.press("Meta+z");
  await expect(page.locator("#inline-body")).toHaveText(content, {
    useInnerText: true,
  });
  await page.keyboard.press("Meta+Shift+z");
  await expect(page.locator("#inline-body")).toHaveText(content + " undo-me", {
    useInnerText: true,
  });
  await page.locator("#inline-body").fill(content);
  // Chinese IME confirmation must not finish editing or submit a dialog.
  await page
    .locator("#inline-body")
    .dispatchEvent("keydown", { key: "Escape", isComposing: true });
  await expect(page.locator("#inline-body")).toBeVisible();
  await expect(editedNode).toHaveAttribute("style", beforeText);
  const textBox = await page.locator("#inline-body").boundingBox();
  await page.mouse.move(textBox.x + 15, textBox.y + 16);
  await page.mouse.down();
  await page.mouse.move(textBox.x + 130, textBox.y + 16, { steps: 8 });
  await page.mouse.up();
  await expect(editedNode).toHaveAttribute("style", beforeText);
  const transformBefore = await page.locator("#world").getAttribute("style");
  await page.mouse.wheel(0, 180);
  await expect(page.locator("#world")).toHaveAttribute(
    "style",
    transformBefore,
  );
  await page.screenshot({ path: "test-results/inline-editing.png" });
  await page.keyboard.press("Meta+Enter");
  await expect(page.locator(".editing")).toHaveCount(0);
  await expect(editedNode.locator(".node-summary")).toContainText("直接在卡片");
  const handle = editedNode.locator("[data-drag-handle]");
  const positionBefore = await editedNode.boundingBox();
  const handleBox = await handle.boundingBox();
  await page.mouse.move(handleBox.x + 85, handleBox.y + 15);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 145, handleBox.y + 50, { steps: 8 });
  await page.mouse.up();
  const positionAfter = await editedNode.boundingBox();
  expect(positionAfter.x - positionBefore.x).toBeCloseTo(60, 0);
  expect(positionAfter.y - positionBefore.y).toBeCloseTo(35, 0);
  await page.locator('[data-action="view"][data-view="cards"]').click();
  await page.locator(`[data-card="${editingId}"] .node-summary`).click();
  await page.locator("#inline-body").fill("卡片视图也可以直接编辑。");
  await click("finish-edit");
  await expect(
    page.locator(`[data-card="${editingId}"] .node-summary`),
  ).toHaveText("卡片视图也可以直接编辑。");
  await expect(page.locator(".inspector")).toHaveCount(0);
  console.log(
    "PASS inline editing / native text undo-redo / IME guard / selection / scroll / header drag / card view",
  );
  await click("new-project");
  await page.locator("#modal-title").fill("桌面验收项目");
  await page.locator("#modal-goal").fill("验证实际完整闭环");
  await click("save-project");
  await click("new-card");
  await page
    .locator('[data-action="new-card-type"][data-type="requirement"]')
    .click();
  await page.locator("#modal-title").fill("需要保留判断理由");
  await page.locator("#modal-body").fill("把每个选择的依据记录下来");
  await click("create-card");
  await click("child");
  await page.locator("#modal-title").fill("采用可追溯卡片");
  await page.locator("#modal-body").fill("将资料、判断和决策分别保存");
  await click("create-card");
  const richCardId = await page
    .locator(".node.editing")
    .getAttribute("data-node");
  // Observe native dispatch without changing the user's clipboard or opening tabs.
  await app.evaluate(({ shell, clipboard }) => {
    globalThis.testOpenedURLs = [];
    globalThis.testCopiedPNG = "";
    shell.openExternal = async (url) => {
      globalThis.testOpenedURLs.push(url);
    };
    clipboard.write = async (items) => {
      globalThis.testCopiedPNG = Buffer.from(
        await (await items[0].getType("image/png")).arrayBuffer(),
      ).toString("base64");
    };
  });
  await page.locator("#inline-body").fill("产品参考");
  await page.locator("#inline-body").evaluate((body) => {
    const range = document.createRange();
    range.selectNodeContents(body);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
  await page.keyboard.press("Meta+k");
  await expect(page.locator("#modal-label")).toHaveValue("产品参考");
  await page.locator("#modal-url").fill("javascript:alert(1)");
  await click("apply-link");
  await expect(page.locator(".error-box")).toContainText("有效");
  await page.locator("#modal-url").fill("https://example.com/reference");
  await click("apply-link");
  await expect(
    page.locator('#inline-body a[href="https://example.com/reference"]'),
  ).toHaveText("产品参考");
  await page.locator("#inline-body a").click();
  expect(await app.evaluate(() => globalThis.testOpenedURLs)).toEqual([
    "https://example.com/reference",
  ]);
  await page.locator("#inline-body").evaluate((body) => {
    body.focus();
    const range = document.createRange();
    range.selectNodeContents(body);
    range.collapse(false);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    const data = new DataTransfer();
    data.setData("text/plain", "\nhttps://example.org/guide");
    body.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(
    page.locator('#inline-body a[href="https://example.org/guide"]'),
  ).toHaveCount(1);
  await page.locator("#inline-body").evaluate((body) => {
    const data = new DataTransfer();
    data.setData(
      "text/html",
      '<a href="javascript:alert(1)" onclick="window.pasteUnsafe=true">不安全链接</a><img src="https://example.org/track.png" onerror="window.pasteUnsafe=true"><script>window.pasteUnsafe=true</script>',
    );
    body.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(
    page.locator(
      '#inline-body [onclick], #inline-body [onerror], #inline-body script, #inline-body img[src^="http"], #inline-body a[href^="javascript"]',
    ),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.pasteUnsafe)).toBeUndefined();
  const imageData = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 150;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4eadf";
    ctx.fillRect(0, 0, 320, 150);
    ctx.fillStyle = "#bc7047";
    ctx.fillRect(24, 30, 70, 80);
    ctx.fillStyle = "#464d3e";
    ctx.font = "22px sans-serif";
    ctx.fillText("产品参考图", 116, 78);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator("#inline-body").evaluate((body, base64) => {
    const file = new File(
      [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
      "粘贴参考图.png",
      { type: "image/png" },
    );
    const data = new DataTransfer();
    data.items.add(file);
    body.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, imageData);
  await expect(page.locator("#inline-body img")).toHaveCount(1);
  const chooser = page.waitForEvent("filechooser");
  await click("insert-image");
  await (
    await chooser
  ).setFiles({
    name: "本地参考图.png",
    mimeType: "image/png",
    buffer: Buffer.from(imageData, "base64"),
  });
  await expect(page.locator("#inline-body img")).toHaveCount(2);
  await page.locator("#inline-body img").first().click();
  await expect(page.locator(".image-preview")).toBeVisible();
  await click("copy-image");
  expect(
    (await app.evaluate(() => globalThis.testCopiedPNG)).length,
  ).toBeGreaterThan(100);
  await click("remove-image");
  await expect(page.locator("#inline-body img")).toHaveCount(1);
  await page.keyboard.press("Meta+z");
  await expect(page.locator("#inline-body img")).toHaveCount(2);
  await page.locator("#inline-body").evaluate((body) => {
    window.getSelection().removeAllRanges();
    body.closest(".card-editor-body").scrollTop = 0;
  });
  await page.screenshot({ path: "test-results/rich-card.png" });
  await click("finish-edit");
  await expect(
    page.locator(`[data-card="${richCardId}"] .node-thumbnail img`),
  ).toBeVisible();
  await page
    .locator(
      `[data-card="${richCardId}"] a[href="https://example.com/reference"]`,
    )
    .click();
  expect((await app.evaluate(() => globalThis.testOpenedURLs)).length).toBe(2);
  await page.locator(`[data-card="${richCardId}"] .node-title`).click();
  await expect(page.locator("#inline-body img")).toHaveCount(2);
  console.log(
    "PASS image paste / file insertion / preview / copy dispatch / named and pasted links / browser dispatch",
  );
  await click("child");
  await page.locator("#modal-title").fill("判断信息结构是否可行");
  await click("create-card");
  await page.locator("#inline-conclusion").selectOption("有条件可行");
  await page.locator("#inline-rationale").fill("能明确区分事实认识与行动选择");
  await click("confirm-card");
  await expect(page.locator("#toast")).toContainText("成立条件");
  await page.locator("#inline-conditions").fill("需要用真实项目验证");
  await click("confirm-card");
  await expect(page.locator(".editing .card-confirm-state")).toContainText(
    "已确认",
  );
  await click("child");
  await page.locator("#modal-title").fill("第一版采用此方案");
  await click("create-card");
  await page.locator("#inline-rationale").fill("先建立个人思考闭环");
  await page.locator("#inline-scope").fill("Mac 第一版");
  await page.locator("[data-choice]").first().selectOption("采用");
  await click("confirm-card");
  await expect(page.locator(".editing .card-confirm-state")).toContainText(
    "已确认",
  );
  await page.screenshot({ path: "test-results/inline-decision.png" });
  await page.locator('[data-action="view"][data-view="prd"]').last().click();
  await click("generate-prd");
  await click("prepare-prd");
  await click("save-prd");
  await expect(page.locator("#doc-scope")).toContainText("采用可追溯卡片");
  await page.locator("#doc-flow").fill("用户手动补充的流程，必须保留。");
  await click("snapshot-document");
  await expect(page.locator("#doc-flow")).toHaveValue(
    "用户手动补充的流程，必须保留。",
  );
  await page.screenshot({ path: "test-results/prd-document.png" });
  console.log("PASS create cards / confirmation rules / PRD / manual edits");
  const backup = path.join(root, "backup.mindtrace");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, backup);
  await click("project-menu");
  await click("export-project");
  await expect(page.locator("#toast")).toContainText("导出");
  const exported = JSON.parse(await readFile(backup, "utf8"));
  expect(exported.project.documents).toHaveLength(2);
  expect(
    exported.project.attachments.filter((a) => a.mime === "image/png"),
  ).toHaveLength(2);
  expect(
    exported.project.cards.find((c) => c.id === richCardId).bodyHtml,
  ).toContain('href="https://example.com/reference"');
  const pdf = path.join(root, "research.pdf");
  await writeFile(pdf, makePDF());
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, pdf);
  await click("import-file");
  await click("pick-file");
  await expect(page.locator("#field-excerpt")).toHaveValue(
    /Evidence source for MindTrace/,
    { timeout: 30000 },
  );
  await page.locator('.inspector [data-action="edit-card"]').click();
  await expect(page.locator("#inline-source")).toHaveValue("research.pdf");
  console.log("PASS native project export / PDF extraction / attachment copy");
  await click("settings");
  await page
    .locator("#modal-endpoint")
    .fill(`http://127.0.0.1:${port}/v1/chat/completions`);
  await page.locator("#modal-model").fill("local-test-fixture");
  await click("save-settings");
  await click("ai");
  await page.locator("#modal-task").selectOption("idea");
  await click("run-ai");
  await expect(page.locator(".suggestion")).toHaveCount(2, { timeout: 15000 });
  await page.locator("[data-suggestion]").first().fill("已编辑的 AI 想法");
  await page.locator('[data-action="accept-suggestion"]').first().click();
  await expect(
    page.locator('[data-action="accept-suggestion"]').first(),
  ).toBeDisabled();
  await click("close-modal");
  await click("ai");
  await page.locator("#modal-task").selectOption("idea");
  await page.locator("#modal-instruction").fill("测试取消");
  await click("run-ai");
  await click("cancel-ai");
  await expect(page.locator(".error-box")).toContainText("取消");
  await expect(page.locator(".suggestion")).toHaveCount(0);
  await click("close-modal");
  console.log(
    "PASS AI HTTP integration / edit and partial adoption / cancellation (local fixture)",
  );
  await page.evaluate(() => window.flushMindTrace());
  const saved = JSON.parse(
    await readFile(path.join(root, "workspace.json"), "utf8"),
  );
  const current = saved.projects.find((p) => p.id === saved.currentProject);
  expect(
    saved.projects.flatMap((p) => p.cards).find((c) => c.id === editingId).body,
  ).toBe("卡片视图也可以直接编辑。");
  expect(
    current.cards.filter((c) => c.body === "已编辑的 AI 想法"),
  ).toHaveLength(1);
  expect(current.attachments).toHaveLength(3);
  expect(current.cards.find((c) => c.id === richCardId).bodyHtml).not.toContain(
    "base64",
  );
  expect(
    current.documents.at(-1).sections.find((s) => s.key === "flow").text,
  ).toContain("用户手动");
  expect(JSON.stringify(saved)).not.toContain("apiKey");
  await app.close();
  await launch();
  await expect(page.locator("h1").first()).toContainText("桌面验收项目");
  await page.locator(`[data-card="${richCardId}"] .node-title`).click();
  await expect(page.locator("#inline-body img")).toHaveCount(2);
  expect(
    await page
      .locator("#inline-body img")
      .first()
      .evaluate((img) => img.complete && img.naturalWidth === 320),
  ).toBe(true);
  await expect(
    page.locator('#inline-body a[href="https://example.com/reference"]'),
  ).toHaveText("产品参考");
  await page.locator('[data-action="view"][data-view="prd"]').last().click();
  await expect(page.locator("#doc-flow")).toHaveValue(
    "用户手动补充的流程，必须保留。",
  );
  console.log("PASS restart persistence");
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, backup);
  await click("project-menu");
  await click("import-project");
  await expect(page.locator("h1").first()).toContainText("导入副本");
  await page.locator(`[data-card="${richCardId}"] .node-title`).click();
  await expect(page.locator("#inline-body img")).toHaveCount(2);
  await expect(
    page.locator('#inline-body a[href="https://example.com/reference"]'),
  ).toHaveText("产品参考");
  console.log("PASS project restore without overwriting existing project");
  expect(requests).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/desktop-final.png" });
  console.log("ALL DESKTOP UI CHECKS PASSED");
} finally {
  if (app) await app.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
}
