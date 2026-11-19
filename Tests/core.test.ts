import test from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  createCard,
  editCard,
  confirmCard,
  addLink,
  reparent,
  removeCard,
  layout,
  prdSections,
  documentMarkdown,
  acceptSuggestion,
  parseSuggestions,
  validateProject,
  clone,
  demoProject,
} from "../Web/core.ts";
import type { PRDocument } from "../Web/types.ts";

function scenario() {
  const p = createProject("研究工作台", "让方案有依据");
  const r = createCard("requirement", "整理需求", null, {
    body: "需求原文",
    audience: "个人用户",
    scenario: "产品思考",
  });
  const a = createCard("idea", "采用方案", r.id, { body: "用卡片保存理由" }),
    b = createCard("idea", "暂缓方案", r.id, { body: "自动替用户做决策" });
  const evidence = createCard("evidence", "原始访谈", a.id, {
    excerpt: "原始文字",
    source: "个人访谈笔记",
  });
  const j = createCard("judgment", "可行性", a.id, {
    conclusion: "可行",
    rationale: "符合目标",
  });
  const d = createCard("decision", "本期选择", r.id, {
    rationale: "先满足个人使用",
    scope: "第一版",
    choices: { [a.id]: "采用", [b.id]: "暂缓" },
  });
  p.cards = [r, a, b, evidence, j, d];
  addLink(p, evidence.id, j.id, "支持");
  addLink(p, j.id, d.id, "依据");
  confirmCard(p, j.id);
  confirmCard(p, d.id);
  return { p, r, a, b, evidence, j, d };
}
test("判断与决策分别保留理由，可行的方案仍可暂缓", () => {
  const { p, j, d, b } = scenario();
  const j2 = createCard("judgment", "可行但不采用", b.id, {
    conclusion: "可行",
    rationale: "技术路径清楚",
  });
  p.cards.push(j2);
  confirmCard(p, j2.id);
  assert.equal(j2.conclusion, "可行");
  assert.equal(d.choices[b.id], "暂缓");
  assert.notEqual(j.rationale, d.rationale);
});
test("有条件可行必须有条件，确认不能丢掉理由", () => {
  const { p, j } = scenario();
  editCard(p, j.id, { conclusion: "有条件可行", conditions: "" });
  assert.throws(() => confirmCard(p, j.id), /成立条件/);
  editCard(p, j.id, { conditions: "需要真实项目验证" });
  confirmCard(p, j.id);
  assert.equal(j.confirmed, true);
});
test("缺少决策范围或选择结果不能确认", () => {
  const { p, d } = scenario();
  editCard(p, d.id, { scope: "" });
  assert.throws(() => confirmCard(p, d.id), /范围/);
  editCard(p, d.id, { scope: "第一版", choices: {} });
  assert.throws(() => confirmCard(p, d.id), /选择结果/);
});
test("修订保存旧版本，更新后的理由不改变历史快照", () => {
  const { p, j } = scenario();
  editCard(p, j.id, { rationale: "新的判断理由" });
  assert.equal(j.confirmed, false);
  assert.equal(j.history[0].content.rationale, "符合目标");
  confirmCard(p, j.id);
  assert.equal(j.revision, 2);
  assert.equal(j.history.length, 1);
});
test("同一份证据支持多个判断，修改使两处依赖待复核", () => {
  const { p, j, evidence, a } = scenario();
  const other = createCard("judgment", "第二个判断", a.id, {
    rationale: "参考原文",
    conclusion: "可行",
  });
  p.cards.push(other);
  confirmCard(p, other.id);
  addLink(p, evidence.id, other.id, "支持");
  editCard(p, evidence.id, { excerpt: "修订后原文" });
  assert.equal(j.needsReview, true);
  assert.equal(other.needsReview, true);
  assert.equal(p.cards.filter((c) => c.id === evidence.id).length, 1);
});
test("PRD 只把已确认采用方案写进功能范围", () => {
  const { p, r, d, a, b } = scenario();
  const proposal = prdSections(p, [r.id, d.id]);
  const features = proposal.sections.find((s) => s.key === "scope")!.text;
  assert.match(features, new RegExp(a.title));
  assert.doesNotMatch(features, new RegExp(b.title));
  assert.match(
    proposal.sections.find((s) => s.key === "tradeoffs")!.text,
    /暂缓/,
  );
  d.confirmed = false;
  assert.doesNotMatch(
    prdSections(p, [r.id, d.id]).sections.find((s) => s.key === "scope")!.text,
    new RegExp(a.title),
  );
});
test("PRD 缺失信息显示待确认，并保留引用时的内容", () => {
  const { p, r, d } = scenario();
  const proposal = prdSections(p, [r.id, d.id]);
  assert.match(proposal.sections.find((s) => s.key === "flow")!.text, /待确认/);
  const source = proposal.sources.find((s) => s.id === d.id)!;
  editCard(p, d.id, { rationale: "新理由" });
  assert.equal(source.content.rationale, "先满足个人使用");
});
test("依据修订只标记文档，不覆盖手动编辑", () => {
  const { p, r, d, evidence } = scenario();
  const proposal = prdSections(p, [r.id, d.id]);
  const doc: PRDocument = {
    ...proposal,
    id: "doc",
    created: "2026-11-19",
    version: 1,
    needsReview: false,
  };
  doc.sections[0].text = "用户手动内容";
  p.documents.push(doc);
  editCard(p, evidence.id, { body: "新增信息" });
  assert.equal(doc.needsReview, true);
  assert.equal(doc.sections[0].text, "用户手动内容");
  assert.match(documentMarkdown(p, doc), /用户手动内容/);
});
test("采用结果与验证进度彼此独立", () => {
  const { p, d, a } = scenario();
  const v = createCard("validation", "验证", d.id, {
    progress: "已结束",
    outcome: "未通过",
  });
  p.cards.push(v);
  editCard(p, v.id, { outcome: "未通过" });
  assert.equal(d.choices[a.id], "采用");
});
test("删除保留关联和历史，子卡片仍可找到", () => {
  const { p, j, d } = scenario();
  removeCard(p, j.id);
  assert.ok(p.links.some((l) => l.from === j.id && l.to === d.id));
  assert.ok(j.history.length);
  assert.equal(d.needsReview, true);
  assert.equal(p.cards.find((c) => c.id === j.id)?.deleted, true);
});
test("不能把父节点放到后代之下", () => {
  const { p, r, a } = scenario();
  assert.throws(() => reparent(p, r.id, a.id), /子节点/);
  assert.equal(r.parentId, null);
});
test("搜索会展开匹配卡片的上下文，即使父节点已折叠", () => {
  const { p, r, a } = scenario();
  r.collapsed = true;
  assert.ok(!layout(p).some((n) => n.id === a.id));
  const nodes = layout(p, "all", a.title);
  assert.ok(nodes.some((n) => n.id === a.id));
  assert.ok(nodes.some((n) => n.id === r.id));
});
test("原位编辑卡片变大时，自动布局为整条分支留出空间", () => {
  const { p, a } = scenario();
  const nodes = layout(p, "all", "", (c) =>
    c.id === a.id ? { width: 360, height: 500 } : { width: 280, height: 200 },
  );
  for (let i = 0; i < nodes.length; i++) {
    for (const b of nodes.slice(i + 1)) {
      const n = nodes[i];
      assert.ok(
        n.x + n.width <= b.x ||
          b.x + b.width <= n.x ||
          n.y + n.height <= b.y ||
          b.y + b.height <= n.y,
        `${n.title} 与 ${b.title} 不应重叠`,
      );
    }
  }
  a.x = 42;
  a.y = 73;
  const moved = layout(p).find((c) => c.id === a.id)!;
  assert.equal(moved.x, 42);
  assert.equal(moved.y, 73);
});
test("AI 建议部分采纳且重复点击不生成副本", () => {
  const { p, r } = scenario();
  const suggestions = parseSuggestions(
    '{"cards":[{"title":"新想法 A","body":"假设"},{"title":"新想法 B","body":"假设"}]}',
    "idea",
  );
  const before = p.cards.length;
  acceptSuggestion(p, suggestions[0], r.id);
  acceptSuggestion(p, suggestions[0], r.id);
  assert.equal(p.cards.length, before + 1);
  assert.ok(!p.cards.some((c) => c.title === "新想法 B"));
});
test("没有实际出处的搜索资料不能采纳", () => {
  const { p, r } = scenario();
  assert.throws(
    () =>
      acceptSuggestion(
        p,
        {
          id: "missing",
          type: "evidence",
          title: "伪造资料",
          source: "https://example.com",
        },
        r.id,
      ),
    /出处/,
  );
});
test("AI 非结构化输出报错，不制造成功卡片", () => {
  assert.throws(() => parseSuggestions("我不知道", "idea"), /有效/);
});
test("完整项目序列化保留附件、版本与来源", () => {
  const { p, r, d } = scenario();
  p.attachments.push({
    id: "pdf",
    name: "notes.pdf",
    data: Buffer.from("test").toString("base64"),
  });
  p.documents.push({
    ...prdSections(p, [r.id, d.id]),
    id: "doc",
    created: "2026-11-19",
    version: 1,
    needsReview: false,
  });
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
});
test("导入时拒绝循环层级和重复标识", () => {
  const { p, r, a } = scenario();
  const invalid = clone(p);
  invalid.cards.find((c) => c.id === r.id)!.parentId = a.id;
  assert.throws(() => validateProject(invalid), /循环/);
  const duplicate = clone(p);
  duplicate.cards.push(clone(duplicate.cards[0]));
  assert.throws(() => validateProject(duplicate), /重复/);
});
test("默认演示项目可以完整验证与布局", () => {
  const p = demoProject();
  validateProject(p);
  assert.equal(layout(p).length, p.cards.length);
  assert.ok(p.cards.some((c) => c.origin === "演示资料"));
});
test("已删除的判断对象不能作为确认依据", () => {
  const { p, a, j } = scenario();
  removeCard(p, a.id);
  editCard(p, j.id, { rationale: "修订判断" });
  assert.throws(() => confirmCard(p, j.id), /有效的判断对象/);
});
test("拒绝不存在的分支与伪造卡片类型", () => {
  const { p, a } = scenario();
  assert.throws(() => reparent(p, a.id, "missing"), /不存在/);
  const malformed = clone(p);
  malformed.cards[0].type = "__proto__" as never;
  assert.throws(() => validateProject(malformed), /无效/);
});
