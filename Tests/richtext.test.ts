import test from "node:test";
import assert from "node:assert/strict";
import { linkURL, linkedText } from "../Web/richtext.ts";
import {
  createCard,
  createProject,
  editCard,
  validateProject,
  clone,
} from "../Web/core.ts";

test("网址转为可访问链接，拒绝脚本、本地文件和带凭据的地址", () => {
  assert.equal(linkURL("www.example.com/docs"), "https://www.example.com/docs");
  for (const value of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "data:text/html,x",
    "https://user:secret@example.com",
  ])
    assert.equal(linkURL(value), null);
  const html = linkedText(
    "参考 https://example.com/page。\n<script>文本</script>",
  );
  assert.ok(
    html.includes(
      '<a href="https://example.com/page">https://example.com/page</a>。<br>',
    ),
  );
  assert.ok(html.includes("&lt;script&gt;"));
});

test("图文备份保留链接与图片引用，旧版纯文字项目仍可读取", () => {
  const p = createProject("图文项目"),
    c = createCard("idea", "示意图");
  p.cards.push(c);
  assert.equal(validateProject(clone(p)).cards[0].bodyHtml, undefined);
  p.attachments.push({
    id: "image-1",
    name: "图.png",
    mime: "image/png",
    data: "AA==",
  });
  editCard(p, c.id, {
    body: "参考图",
    bodyHtml:
      '<a href="https://example.com/">参考</a><img data-image-id="image-1">',
  });
  const restored = validateProject(clone(p));
  assert.equal(restored.cards[0].bodyHtml, c.bodyHtml);
  assert.equal(restored.attachments[0].data, "AA==");
  c.confirmed = true;
  editCard(p, c.id, { body: "AI 更新摘要" });
  assert.equal(c.bodyHtml, undefined);
  assert.ok(c.history[0].content.bodyHtml?.includes("image-1"));
  assert.equal(p.attachments.length, 1);
});
