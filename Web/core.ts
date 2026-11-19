import type {
  Card,
  CardType,
  Project,
  PRDocument,
  Suggestion,
  Source,
} from "./types.ts";
export const TYPES: Record<
  CardType,
  {
    name: string;
    color: string;
    icon: string;
    label: string;
    fields: string[][];
  }
> = {
  requirement: {
    name: "需求",
    color: "#ce7848",
    icon: "flag",
    label: "问题与目标",
    fields: [
      ["body", "原始需求"],
      ["audience", "目标用户"],
      ["scenario", "使用场景"],
      ["goal", "目标"],
      ["constraints", "约束条件"],
    ],
  },
  idea: {
    name: "想法",
    color: "#a78841",
    icon: "bulb",
    label: "可能的解决方式",
    fields: [
      ["body", "方案描述"],
      ["benefit", "预期收益"],
      ["assumptions", "关键假设"],
      ["questions", "待研究问题"],
    ],
  },
  evidence: {
    name: "资料",
    color: "#648984",
    icon: "book",
    label: "信息与证据",
    fields: [
      ["source", "来源链接或名称"],
      ["location", "页码 / 段落"],
      ["sourceDate", "来源日期（未知可留空）"],
      ["excerpt", "原文摘录"],
      ["body", "摘要"],
      ["notes", "个人备注"],
    ],
  },
  judgment: {
    name: "判断",
    color: "#7789af",
    icon: "scale",
    label: "结论与成立条件",
    fields: [
      ["dimension", "判断维度"],
      ["body", "分析说明"],
      ["rationale", "判断理由"],
      ["conditions", "成立条件"],
      ["questions", "证据缺口 / 后续研究"],
    ],
  },
  decision: {
    name: "决策",
    color: "#997d9f",
    icon: "check",
    label: "选择与取舍",
    fields: [
      ["body", "决策问题"],
      ["rationale", "决策理由"],
      ["scope", "适用范围"],
      ["tradeoffs", "取舍与未采用理由"],
      ["revisit", "重新评估的条件"],
    ],
  },
  validation: {
    name: "验证",
    color: "#699170",
    icon: "flask",
    label: "用结果检验选择",
    fields: [
      ["body", "待验证假设"],
      ["method", "验证方法"],
      ["criteria", "通过标准"],
      ["result", "实际结果"],
      ["next", "后续动作"],
    ],
  },
};
export const JUDGMENTS = ["未判断", "可行", "有条件可行", "不可行", "证据不足"];
export const CHOICES = ["未决定", "采用", "暂缓", "放弃"];
export const RELATIONS = [
  "支持",
  "反驳",
  "依据",
  "回应",
  "评估",
  "验证",
  "参考",
];
export const uid = () => globalThis.crypto.randomUUID();
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const now = () => new Date().toISOString();
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export const activeCards = (p: Project) => p.cards.filter((c) => !c.deleted);
export function createProject(title = "未命名项目", goal = ""): Project {
  return {
    id: uid(),
    title,
    goal,
    created: now(),
    updated: now(),
    cards: [],
    links: [],
    documents: [],
    attachments: [],
    acceptedSuggestions: [],
  };
}
export function createCard(
  type: CardType,
  title: string,
  parentId: string | null = null,
  extra: Partial<Card> = {},
): Card {
  if (!Object.hasOwn(TYPES, type)) throw new Error("未知卡片类型");
  return {
    id: uid(),
    type,
    title: title || `新的${TYPES[type].name}`,
    parentId,
    body: "",
    created: now(),
    updated: now(),
    origin: "手动创建",
    confirmed: false,
    revision: 0,
    history: [],
    needsReview: false,
    conclusion: type === "judgment" ? "未判断" : "",
    progress: "未开始",
    outcome: "结果不确定",
    choices: {},
    collapsed: false,
    deleted: false,
    ...extra,
  };
}
export function snapshot(card: Card) {
  const { history, ...content } = card;
  return clone(content);
}
export function dependents(p: Project, id: string) {
  const result = new Set(p.links.filter((l) => l.from === id).map((l) => l.to));
  for (const c of activeCards(p))
    if (c.parentId === id || Object.keys(c.choices || {}).includes(id))
      result.add(c.id);
  return result;
}
export function markDependents(p: Project, id: string) {
  const ids = dependents(p, id);
  for (const c of p.cards) if (ids.has(c.id)) c.needsReview = true;
  for (const doc of p.documents)
    if ((doc.sources || []).some((s) => s.id === id)) doc.needsReview = true;
}
export function editCard(p: Project, id: string, fields: Partial<Card>) {
  const c = p.cards.find((c) => c.id === id);
  if (!c) throw new Error("卡片不存在");
  if (
    Object.entries(fields).every(
      ([k, v]) => JSON.stringify(c[k]) === JSON.stringify(v),
    )
  )
    return;
  if (c.confirmed) {
    c.history.push({ at: now(), content: snapshot(c) });
    c.confirmed = false;
  }
  // Plain-text replacements (for example an adopted AI summary) must not leave
  // an older rich-text body visible over the new content.
  if (Object.hasOwn(fields, "body") && !Object.hasOwn(fields, "bodyHtml"))
    delete c.bodyHtml;
  Object.assign(c, fields, { updated: now() });
  markDependents(p, id);
  p.updated = now();
}
export function confirmCard(p: Project, id: string) {
  const c = p.cards.find((c) => c.id === id && !c.deleted);
  if (!c) throw new Error("卡片不存在");
  if (!c.title.trim()) throw new Error("请填写标题");
  if (["judgment", "decision"].includes(c.type) && !c.rationale?.trim())
    throw new Error(`请填写${TYPES[c.type].name}理由`);
  if (c.type === "judgment") {
    if (
      !activeCards(p).some((n) => n.id === c.parentId) &&
      !p.links.some(
        (l) =>
          l.to === id &&
          l.type === "评估" &&
          activeCards(p).some((n) => n.id === l.from),
      )
    )
      throw new Error("请关联有效的判断对象，或将判断放到对象下面");
    if (!JUDGMENTS.slice(1).includes(c.conclusion))
      throw new Error("请选择判断结论");
    if (c.conclusion === "有条件可行" && !c.conditions?.trim())
      throw new Error("有条件可行需要填写成立条件");
  }
  if (c.type === "decision") {
    if (
      !Object.entries(c.choices).some(
        ([id, v]) =>
          v !== "未决定" &&
          activeCards(p).some((i) => i.id === id && i.type === "idea"),
      )
    )
      throw new Error("请为至少一个备选想法选择结果");
    if (!c.scope?.trim()) throw new Error("请填写决策适用范围");
  }
  c.confirmed = true;
  c.needsReview = false;
  c.revision += 1;
  c.updated = now();
  markDependents(p, id);
}
export function reparent(p: Project, id: string, parentId: string | null) {
  if (id === parentId) throw new Error("卡片不能成为自己的父节点");
  if (parentId && !activeCards(p).some((c) => c.id === parentId))
    throw new Error("目标分支不存在");
  let current = parentId;
  const visited = new Set();
  while (current) {
    if (current === id || visited.has(current))
      throw new Error("不能移动到自己的子节点中");
    visited.add(current);
    current = p.cards.find((c) => c.id === current)?.parentId ?? null;
  }
  editCard(p, id, { parentId, x: undefined, y: undefined });
}
export function addLink(p: Project, from: string, to: string, type = "参考") {
  if (from === to) throw new Error("请选择另一张卡片");
  if (![from, to].every((id) => activeCards(p).some((c) => c.id === id)))
    throw new Error("关联卡片不存在");
  if (!RELATIONS.includes(type)) throw new Error("关联类型无效");
  if (p.links.some((l) => l.from === from && l.to === to && l.type === type))
    return;
  p.links.push({ id: uid(), from, to, type });
  const target = p.cards.find((c) => c.id === to);
  if (target?.confirmed) target.needsReview = true;
}
export function removeCard(p: Project, id: string) {
  editCard(p, id, { deleted: true });
}
export function layout(
  p: Project,
  filter = "all",
  query = "",
  size: (c: Card) => { width: number; height: number } = () => ({
    width: 280,
    height: 200,
  }),
) {
  const cards = activeCards(p),
    byId = new Map(cards.map((c) => [c.id, c]));
  const term = query.trim().toLowerCase();
  const matches = new Set(
    cards
      .filter(
        (c) =>
          (filter === "all" ||
            c.type === filter ||
            c.conclusion === filter ||
            Object.values(c.choices).includes(filter)) &&
          (!term ||
            [c.title, c.body, c.rationale, c.excerpt]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(term)),
      )
      .map((c) => c.id),
  );
  const contextual = new Set(matches);
  for (const id of matches) {
    let c = byId.get(id);
    const seen = new Set();
    while (c?.parentId && !seen.has(c.parentId)) {
      seen.add(c.parentId);
      contextual.add(c.parentId);
      c = byId.get(c.parentId);
    }
  }
  const filtering = filter !== "all" || !!term;
  const nodes: (Card & {
      x: number;
      y: number;
      dim: boolean;
      children: number;
      width: number;
      height: number;
    })[] = [],
    visited = new Set<string>();
  const spans = new Map<string, number>();
  const widths: number[] = [];
  const childrenOf = (c: Card) =>
    c.collapsed && !filtering
      ? []
      : cards.filter(
          (n) => n.parentId === c.id && (!filtering || contextual.has(n.id)),
        );
  const measure = (c: Card, depth: number): number => {
    if (visited.has(c.id) || (filtering && !contextual.has(c.id))) return 0;
    visited.add(c.id);
    widths[depth] = Math.max(widths[depth] || 0, size(c).width);
    const children = childrenOf(c);
    const span = Math.max(
      size(c).height,
      children.reduce((sum, n) => sum + measure(n, depth + 1), 0) +
        Math.max(0, children.length - 1) * 32,
    );
    spans.set(c.id, span);
    return span;
  };
  const roots = cards.filter((c) => !c.parentId || !byId.has(c.parentId));
  roots.forEach((c) => measure(c, 0));
  const walk = (c: Card, depth: number, top: number) => {
    const span = spans.get(c.id);
    if (span === undefined) return;
    const children = childrenOf(c);
    const childSpan =
      children.reduce((sum, n) => sum + (spans.get(n.id) || 0), 0) +
      Math.max(0, children.length - 1) * 32;
    let childTop = top + (span - childSpan) / 2;
    for (const child of children) {
      walk(child, depth + 1, childTop);
      childTop += (spans.get(child.id) || 0) + 32;
    }
    const dimensions = size(c);
    nodes.push({
      ...c,
      ...dimensions,
      x:
        c.x ??
        76 + widths.slice(0, depth).reduce((sum, width) => sum + width + 64, 0),
      y: c.y ?? top + (span - dimensions.height) / 2,
      dim: !matches.has(c.id),
      children: cards.filter((n) => n.parentId === c.id).length,
    });
  };
  let top = 66;
  for (const root of roots) {
    walk(root, 0, top);
    top += (spans.get(root.id) || 0) + 48;
  }
  return nodes;
}
export function sourceClosure(p: Project, ids: string[]): Card[] {
  const result = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of activeCards(p))
      if (result.has(c.id)) {
        const dependencies = [
          c.parentId,
          ...Object.keys(c.choices || {}),
          ...p.links.filter((l) => l.to === c.id).map((l) => l.from),
        ];
        for (const id of dependencies)
          if (id && !result.has(id)) {
            result.add(id);
            changed = true;
          }
      }
  }
  return [...result]
    .map((id) => p.cards.find((c) => c.id === id))
    .filter((c): c is Card => !!c);
}
export function prdSections(p: Project, selectedIds: string[]) {
  const selected = activeCards(p).filter((c) => selectedIds.includes(c.id));
  const requirements = selected.filter((c) => c.type === "requirement");
  const decisions = selected.filter(
    (c) => c.type === "decision" && c.confirmed,
  );
  const ref = (c: Card) =>
    `[${c.title} · v${c.revision}](mindtrace://card/${c.id})`;
  const bullet = (s) => s || "待确认";
  const ideas = activeCards(p).filter((c) => c.type === "idea");
  const sources = sourceClosure(
    p,
    [...requirements, ...decisions].map((c) => c.id),
  );
  const pending = sources.filter(
    (c) =>
      c.needsReview ||
      (c.type === "judgment" &&
        (!c.confirmed ||
          ["未判断", "证据不足", "有条件可行"].includes(c.conclusion))) ||
      (c.type === "validation" && c.progress !== "已结束"),
  );
  const featureLines = decisions.flatMap((d) =>
    ideas
      .filter((i) => d.choices[i.id] === "采用")
      .map(
        (i) =>
          `### ${i.title}\n\n${bullet(i.body)}\n\n适用范围：${bullet(d.scope)}\n\n决策理由：${bullet(d.rationale)}\n\n依据：${ref(d)} · ${ref(i)}`,
      ),
  );
  const validations = activeCards(p).filter(
    (c) =>
      c.type === "validation" &&
      (sources.some((s) => s.id === c.parentId) ||
        p.links.some(
          (l) => l.to === c.id && sources.some((s) => s.id === l.from),
        )),
  );
  return {
    sections: [
      {
        key: "background",
        title: "背景与目标",
        text: `项目目标：${bullet(p.goal)}\n\n${requirements.map((c) => `### ${c.title}\n\n${bullet(c.body)}\n\n目标用户：${bullet(c.audience)}\n使用场景：${bullet(c.scenario)}\n目标：${bullet(c.goal)}\n约束：${bullet(c.constraints)}\n\n来源：${ref(c)}`).join("\n\n") || "待选择需求。"}`,
      },
      {
        key: "scope",
        title: "本期范围与功能要求",
        text:
          featureLines.join("\n\n") ||
          "暂无已确认采用的方案。请先完成决策，或将本节保留为待确认。",
      },
      {
        key: "flow",
        title: "用户流程",
        text: "待确认：请补充用户入口、操作步骤、异常分支与完成条件。",
      },
      {
        key: "acceptance",
        title: "验收与验证",
        text:
          validations
            .map(
              (c) =>
                `### ${c.title}\n\n方法：${bullet(c.method)}\n通过标准：${bullet(c.criteria)}\n进度：${c.progress}\n结果：${c.progress === "已结束" ? c.outcome : "尚未验证"}\n\n依据：${ref(c)}`,
            )
            .join("\n\n") || "待确认：请为采用方案补充验证方法与通过标准。",
      },
      {
        key: "tradeoffs",
        title: "方案取舍",
        text:
          decisions
            .map(
              (d) =>
                `### ${d.title}\n\n${ideas
                  .filter(
                    (i) => d.choices[i.id] && d.choices[i.id] !== "未决定",
                  )
                  .map((i) => `- ${i.title}：${d.choices[i.id]}`)
                  .join(
                    "\n",
                  )}\n\n取舍理由：${bullet(d.tradeoffs || d.rationale)}\n重新评估条件：${bullet(d.revisit)}\n\n来源：${ref(d)}`,
            )
            .join("\n\n") || "暂无已确认决策。",
      },
      {
        key: "risks",
        title: "风险与待确认",
        text:
          [
            ...pending.map(
              (c) =>
                `- ${ref(c)}：${c.needsReview ? "依据发生变化，待复核；" : ""}${c.conditions || c.questions || "判断或验证尚未完成"}`,
            ),
            ...decisions
              .filter((d) => !validations.some((v) => v.parentId === d.id))
              .map((d) => `- ${ref(d)}：尚未关联验证记录。`),
            ...requirements
              .filter((r) => !r.audience || !r.scenario)
              .map((r) => `- ${ref(r)}：目标用户或使用场景尚未填写。`),
          ].join("\n") || "待确认：发布前复核功能范围、边界与验收标准。",
      },
    ],
    sources: [
      ...new Map(
        [...sources, ...validations].map((c) => [
          c.id,
          {
            id: c.id,
            revision: c.revision,
            title: c.title,
            content: snapshot(c),
          },
        ]),
      ).values(),
    ],
  };
}
export function documentMarkdown(p: Project, d: PRDocument) {
  return `# ${p.title} · PRD\n\n版本：${d.version} · ${formatDate(d.created)}\n\n${d.sections.map((s) => `## ${s.title}\n\n${s.text}`).join("\n\n")}\n\n## 依据快照\n\n${d.sources.map((s) => `### ${s.title} · v${s.revision}\n\n标识：${s.id}\n\n${s.content?.body || ""}\n\n${s.content?.rationale ? `理由：${s.content.rationale}\n\n` : ""}${s.content?.source ? `资料来源：${s.content.source}\n\n` : ""}`).join("\n")}`;
}
export function parseSuggestions(text: string, type: CardType): Suggestion[] {
  let value;
  try {
    value = JSON.parse(
      text
        .trim()
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, ""),
    );
  } catch {
    throw new Error(
      "AI 未返回有效的卡片结构。原始回答已保留，可以调整要求后重试。",
    );
  }
  const list = Array.isArray(value) ? value : value.cards;
  if (!Array.isArray(list) || !list.length)
    throw new Error("AI 回答中没有可用卡片");
  return list.slice(0, 12).map((c) => ({
    id: uid(),
    type,
    title: String(c.title || "AI 建议").slice(0, 200),
    body: String(c.body || ""),
    rationale: String(c.rationale || ""),
    conditions: String(c.conditions || ""),
    assumptions: String(c.assumptions || ""),
    questions: String(c.questions || ""),
    conclusion: JUDGMENTS.includes(c.conclusion) ? c.conclusion : "证据不足",
    origin: "AI 生成",
    accepted: false,
  }));
}
export function acceptSuggestion(
  p: Project,
  s: Suggestion,
  parentId: string | null,
) {
  if ((p.acceptedSuggestions || []).includes(s.id)) return null;
  if (
    s.type === "evidence" &&
    (!s.retrieved || !/^https?:\/\//.test(s.source || "") || !s.excerpt)
  )
    throw new Error("资料缺少实际检索出处或摘录");
  const { id, accepted, ...fields } = s;
  const c = createCard(s.type, s.title, parentId, fields);
  p.cards.push(c);
  (p.acceptedSuggestions ??= []).push(id);
  return c;
}
export function validateProject(p: any): Project {
  if (
    !p ||
    typeof p.title !== "string" ||
    typeof p.id !== "string" ||
    !Array.isArray(p.cards) ||
    !Array.isArray(p.links) ||
    !Array.isArray(p.documents) ||
    !Array.isArray(p.attachments)
  )
    throw new Error("不是有效的思序项目");
  if (p.cards.length > 10000) throw new Error("项目超过 10,000 张卡片");
  const ids = new Set();
  for (const c of p.cards) {
    if (
      !c ||
      typeof c.id !== "string" ||
      ids.has(c.id) ||
      typeof c.type !== "string" ||
      !Object.hasOwn(TYPES, c.type) ||
      typeof c.title !== "string" ||
      typeof c.body !== "string" ||
      (c.bodyHtml !== undefined && typeof c.bodyHtml !== "string") ||
      !Array.isArray(c.history) ||
      !c.choices ||
      typeof c.choices !== "object" ||
      Array.isArray(c.choices)
    )
      throw new Error("卡片格式无效或标识重复");
    ids.add(c.id);
  }
  for (const c of p.cards) {
    const seen = new Set([c.id]);
    let parent = c.parentId;
    while (parent) {
      if (seen.has(parent)) throw new Error("项目包含循环层级");
      seen.add(parent);
      parent = p.cards.find((c) => c.id === parent)?.parentId;
    }
  }
  for (const l of p.links)
    if (!ids.has(l.from) || !ids.has(l.to) || !RELATIONS.includes(l.type))
      throw new Error("项目包含无效关联");
  for (const d of p.documents)
    if (
      !Array.isArray(d.sections) ||
      !Array.isArray(d.sources) ||
      d.sections.some(
        (s) => typeof s.text !== "string" || typeof s.title !== "string",
      )
    )
      throw new Error("文档格式无效");
  for (const a of p.attachments)
    if (
      typeof a.id !== "string" ||
      typeof a.name !== "string" ||
      typeof a.data !== "string" ||
      (a.mime !== undefined &&
        !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
          a.mime,
        ))
    )
      throw new Error("附件格式无效");
  return p;
}
export function demoProject() {
  const p = createProject(
    "让每一个决定，有据可循",
    "把零散需求变成清晰的想法，用资料辅助判断，留下选择的理由。",
  );
  const r = createCard("requirement", "把想法变成可执行的产品方案", null, {
    body: "收到一段需求后，能记录想法、整理资料、判断可行性，并说明最终为什么这样选择。",
    audience: "独立开发者 / 产品设计者",
    scenario: "从模糊需求到产品定义",
    goal: "让思考过程可以追溯、可以继续",
    constraints: "第一版只做 Mac，先服务个人",
  });
  const i1 = createCard("idea", "用卡片串起完整思考过程", r.id, {
    body: "每张卡片承担一个角色。需求、想法、资料、判断和决策通过脑图与关联线连接。",
    benefit: "既保留思考的自由，也能找到结论的依据。",
    assumptions: "这种结构能帮助个人整理思路，仍需实际使用验证。",
  });
  const i2 = createCard("idea", "让 AI 帮忙整理，而由我来选择", r.id, {
    body: "AI 起草想法、总结资料和比较方案；采纳后进入脑图，由用户确认判断和决策。",
    questions: "AI 能否忠实保留原始需求和资料来源？",
  });
  const e = createCard("evidence", "起点：这款产品的原始需求", i1.id, {
    body: "需要分别记录判断理由和决策理由，并能够生成 PRD。",
    excerpt: "“判断有判断理由，决策也有决策理由。”",
    source: "本项目需求讨论 · 示例笔记",
    origin: "演示资料",
    sourceKind: "个人笔记",
  });
  const j = createCard("judgment", "两类理由需要独立保存", i1.id, {
    body: "判断回答是否可行；决策回答现在选择什么。",
    dimension: "信息结构",
    rationale:
      "一个方案即使可行，也可能因为当前范围而被暂缓。两者合并会丢失取舍过程。",
    conclusion: "有条件可行",
    conditions: "实际试用时，用户能区分两个入口。",
    confirmed: true,
    revision: 1,
  });
  const d = createCard("decision", "第一版采用卡片与脑图", i2.id, {
    body: "选择第一版的思考组织方式。",
    rationale: "先完成个人从需求到 PRD 的闭环，再逐步扩展能力。",
    scope: "Mac 端，个人使用",
    tradeoffs: "采用卡片与脑图；AI 辅助先保留为待验证方案。",
    choices: { [i1.id]: "采用", [i2.id]: "暂缓" },
    confirmed: true,
    revision: 1,
  });
  const v = createCard("validation", "用一个真实需求走完流程", d.id, {
    body: "验证整个流程是否顺手。",
    method: "录入需求，比较三个想法，记录取舍，生成 PRD。",
    criteria: "能从 PRD 回到决策，并找到判断理由和资料。",
    progress: "未开始",
  });
  p.cards = [r, i1, e, j, i2, d, v];
  p.links = [
    { id: uid(), from: e.id, to: j.id, type: "支持" },
    { id: uid(), from: j.id, to: d.id, type: "依据" },
  ];
  return p;
}
