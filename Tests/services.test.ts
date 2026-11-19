import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import {
  WorkspaceStore,
  safeURL,
  boundedFetch,
  parseAIResponse,
} from "../electron/services.ts";
import { demoProject } from "../Web/core.ts";
import type { Workspace } from "../Web/types.ts";
test("连续保存保持最后内容，重启读取一致，损坏时可恢复备份", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mindtrace-store-"));
  try {
    const p = demoProject();
    const state: Workspace = { schema: 1, projects: [p], currentProject: p.id };
    const store = new WorkspaceStore(root);
    const first = store.save(state);
    p.title = "第二次保存";
    const second = store.save(state);
    await Promise.all([first, second]);
    assert.equal(
      (await new WorkspaceStore(root).load())!.projects[0].title,
      "第二次保存",
    );
    await writeFile(path.join(root, "workspace.json"), "broken");
    await assert.rejects(store.load());
    await store.recover();
    assert.equal(
      (await store.load())!.projects[0].title,
      "让每一个决定，有据可循",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("拒绝 file 与带凭据的 URL，远程模型要求 HTTPS", () => {
  assert.throws(() => safeURL("file:///etc/passwd"));
  assert.throws(() => safeURL("https://user:password@example.com"));
  assert.throws(() => safeURL("http://example.com", true));
  assert.equal(
    safeURL("http://127.0.0.1:11434/v1/chat/completions", true).hostname,
    "127.0.0.1",
  );
});
test("AI 响应需要有效内容，截断响应不冒充完成", () => {
  assert.equal(
    parseAIResponse({
      choices: [{ message: { content: "好的" }, finish_reason: "stop" }],
    }),
    "好的",
  );
  assert.throws(
    () =>
      parseAIResponse({
        choices: [{ message: { content: "部分" }, finish_reason: "length" }],
      }),
    /长度/,
  );
  assert.throws(() => parseAIResponse({ error: "bad" }), /有效文本/);
});
test("HTTP 错误、超量正文、取消都能返回失败", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/bad") {
      res.statusCode = 401;
      res.end("bad key");
    } else if (req.url === "/slow") {
      setTimeout(() => res.end("late"), 100);
    } else res.end("1234567890");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  try {
    await assert.rejects(boundedFetch(new URL(base + "/bad")), /401/);
    await assert.rejects(boundedFetch(new URL(base), {}, 5), /大小|过大/);
    const controller = new AbortController();
    const pending = boundedFetch(new URL(base + "/slow"), {
      signal: controller.signal,
    });
    controller.abort();
    await assert.rejects(pending);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
