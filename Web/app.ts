import {
  TYPES,
  JUDGMENTS,
  CHOICES,
  RELATIONS,
  uid,
  clone,
  now,
  activeCards,
  createProject,
  createCard,
  editCard,
  confirmCard,
  reparent,
  addLink,
  removeCard,
  layout,
  sourceClosure,
  prdSections,
  documentMarkdown,
  formatDate,
  parseSuggestions,
  acceptSuggestion,
  validateProject,
  demoProject,
} from "./core.ts";
import type {
  Card,
  CardType,
  Project,
  Workspace,
  Settings,
  Suggestion,
  PRDocument,
  Section,
  Source,
} from "./types.ts";
import {
  cleanRichHTML,
  richBody,
  richText,
  linkedText,
  linkURL,
  imageAttachment,
} from "./richtext.ts";

const e = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const paths: Record<string, string> = {
  graph:
    '<circle cx="5" cy="12" r="2.5"/><circle cx="18" cy="5" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m7.5 11 8-5M7.5 13l8 5"/>',
  flag: '<path d="M5 21V3m0 1c5-4 8 4 14 0v10c-6 4-9-4-14 0"/>',
  bulb: '<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0l-1 3H9z"/>',
  book: '<path d="M12 6c-3-3-6-3-10-2v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 2v15"/>',
  scale: '<path d="M12 3v18m-5 0h10M4 7l16-2M4 7 1 14h6zm16-2-3 7h6z"/>',
  check:
    '<path d="m8 12 3 3 6-7"/><rect x="3" y="3" width="18" height="18" rx="5"/>',
  flask:
    '<path d="M9 3h6m-5 0v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
  spark:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4m-2-2h4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  doc: '<path d="M14 2H5v20h14V7zm0 0v6h5M8 12h8m-8 4h8"/>',
  folder: '<path d="M3 6h6l2 2h10v12H3zM3 6V4h6l2 2"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m5 9 7 7 7-7"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="m10 3-1 3-3 1-3 2 1 3-1 3 3 2 3 1 1 3h4l1-3 3-1 3-2-1-3 1-3-3-2-3-1-1-3z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  upload: '<path d="m7 8 5-5 5 5M12 3v12M4 14v6h16v-6"/>',
  download: '<path d="m7 11 5 5 5-5M12 3v13M4 16v5h16v-5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  link: '<path d="m10 13 4-4m-5 6-2 2a4 4 0 0 1-5-5l4-4a4 4 0 0 1 5 0m2-1 2-2a4 4 0 0 1 5 5l-4 4a4 4 0 0 1-5 0"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  restore: '<path d="M3 5v6h6M3 11a9 9 0 1 1 2 7"/>',
  warning: '<path d="m12 3 10 18H2zM12 9v5m0 3v1"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M9 5H3v16h16v-6"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
};
const icon = (name: string) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.doc}</svg>`;
const btn = (action: string, label: string, ic = "", cls = "", data = "") =>
  `<button type="button" data-action="${action}" class="${cls}" ${data}>${ic ? icon(ic) : ""}${label}</button>`;
const iconBtn = (action: string, label: string, ic: string, data = "") =>
  `<button type="button" data-action="${action}" class="icon-btn" aria-label="${label}" title="${label}" ${data}>${icon(ic)}</button>`;
const option = (value: string, label: string, selected: string) =>
  `<option value="${e(value)}" ${value === selected ? "selected" : ""}>${e(label)}</option>`;
let state: Workspace,
  settings: Settings = { endpoint: "", model: "" };
let selected: string | null = null,
  editing: string | null = null,
  detailsOpen = false,
  view = "map",
  filter = "all",
  query = "",
  detailTab = "content",
  docId = "";
let transform = { x: 35, y: 70, z: 0.8 };
let modal: any = null,
  saveTimer: ReturnType<typeof setTimeout> | undefined,
  toastTimer: ReturnType<typeof setTimeout>;
let saveTail: Promise<void> = Promise.resolve(),
  dirty = false,
  saveFailed = false;
let editKey = "",
  editTime = 0;
let richRange: Range | null = null;
let imageTarget: { projectId: string; cardId: string } | null = null;
const histories = new Map<string, { past: Project[]; future: Project[] }>();
const project = () =>
  state.projects.find((p) => p.id === state.currentProject)!;
const card = () =>
  project()?.cards.find((c) => c.id === selected && !c.deleted);
const documentCurrent = () =>
  project().documents.find((d) => d.id === docId) || project().documents.at(-1);
const dom = <T extends HTMLElement = HTMLElement>(q: string) =>
  document.querySelector<T>(q);

async function api(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<any> {
  if (window.mindtrace) return window.mindtrace.invoke(action, payload);
  if (action === "load")
    return {
      state: JSON.parse(localStorage.getItem("mindtrace-preview") || "null"),
      settings: { endpoint: "", model: "" },
    };
  if (action === "save") {
    localStorage.setItem("mindtrace-preview", JSON.stringify(payload.state));
    return true;
  }
  if (action === "openURL") {
    window.open(String(payload.url), "_blank", "noopener");
    return true;
  }
  if (action === "exportMarkdown" || action === "exportProject") {
    const content =
      action === "exportMarkdown"
        ? String(payload.text)
        : JSON.stringify(
            {
              format: "mindtrace-project",
              version: 1,
              project: payload.project,
            },
            null,
            2,
          );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    a.download =
      action === "exportMarkdown"
        ? String(payload.name)
        : `${project().title}.mindtrace`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return true;
  }
  throw new Error(
    "这是浏览器界面预览。请在思序 Mac 应用中使用文件导入和 AI 服务。",
  );
}
function toast(message: string) {
  const target = dom("#toast")!;
  target.textContent = message;
  target.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => target.classList.remove("visible"), 3500);
}
function savingLabel(label: string, error = false) {
  document
    .querySelectorAll(".save-label")
    .forEach(
      (n) =>
        (n.innerHTML = `<span class="save-dot ${error ? "error" : ""}"></span>${e(label)}`),
    );
}
function scheduleSave() {
  dirty = true;
  saveFailed = false;
  savingLabel("保存中");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    flush().catch(() => {});
  }, 350);
}
async function flush() {
  clearTimeout(saveTimer);
  if (dirty) {
    const data = clone(state);
    dirty = false;
    saveTail = saveTail
      .catch(() => {})
      .then(async () => {
        try {
          await api("save", { state: data });
          saveFailed = false;
          if (!dirty) savingLabel("已保存到本机");
        } catch (error) {
          dirty = true;
          saveFailed = true;
          savingLabel("保存失败 · 点击重试", true);
          throw error;
        }
      });
  }
  await saveTail;
  if (saveFailed) throw new Error("保存失败");
}
window.flushMindTrace = flush;
function history() {
  if (!histories.has(state.currentProject))
    histories.set(state.currentProject, { past: [], future: [] });
  return histories.get(state.currentProject)!;
}
function projectSnapshot(p: Project): Project {
  return {
    ...clone({ ...p, attachments: [] }),
    attachments: p.attachments.map((a) => ({ ...a })),
  };
}
function checkpoint() {
  const h = history();
  h.past.push(projectSnapshot(project()));
  if (h.past.length > 70) h.past.shift();
  h.future = [];
}
function mutate(fn: (p: Project) => void, redraw = true) {
  const before = projectSnapshot(project());
  try {
    fn(project());
    history().past.push(before);
    history().future = [];
    if (history().past.length > 70) history().past.shift();
    project().updated = now();
    scheduleSave();
    if (redraw) render();
  } catch (error) {
    state.projects[
      state.projects.findIndex((p) => p.id === state.currentProject)
    ] = before;
    throw error;
  }
}
function edit(id: string, fields: Partial<Card>) {
  const key = id + Object.keys(fields).join(",");
  if (editKey !== key || Date.now() - editTime > 1600) {
    checkpoint();
    editKey = key;
  }
  editTime = Date.now();
  editCard(project(), id, fields);
  scheduleSave();
}
function refreshEditedCard() {
  const c = card();
  if (!c) return;
  const title = dom(".inspector-title");
  if (title) title.textContent = c.title;
  const chip = dom(".detail-meta .state-chip");
  if (chip) {
    chip.textContent = c.needsReview
      ? "待复核"
      : c.confirmed
        ? "已确认 · v" + c.revision
        : "草稿";
    chip.classList.toggle("review", c.needsReview);
  }
  const byId = new Map(project().cards.map((item) => [item.id, item]));
  document.querySelectorAll<HTMLElement>("[data-card]").forEach((node) => {
    const current = byId.get(node.dataset.card!);
    if (!current) return;
    if (current.id === c.id) {
      const title = node.querySelector(".node-title:not(input):not(textarea)");
      if (title) title.textContent = c.title;
    }
    const status = node.querySelector(".card-status");
    if (status) status.textContent = cardStatus(current);
    const confirmation = node.querySelector(".card-confirm-state");
    if (confirmation)
      confirmation.textContent = current.needsReview
        ? "待复核"
        : current.confirmed
          ? "已确认"
          : "草稿";
  });
  document
    .querySelectorAll<HTMLButtonElement>('[data-action="confirm-card"]')
    .forEach((confirm) => {
      confirm.innerHTML =
        icon("check") +
        (c.confirmed
          ? c.needsReview
            ? "确认已复核"
            : "已确认"
          : "确认" + TYPES[c.type].name);
    });
}
function undo(redo = false) {
  const h = history(),
    from = redo ? h.future : h.past,
    to = redo ? h.past : h.future;
  const value = from.pop();
  if (!value) {
    toast(redo ? "没有可重做的操作" : "没有可撤销的操作");
    return;
  }
  to.push(projectSnapshot(project()));
  state.projects[
    state.projects.findIndex((p) => p.id === state.currentProject)
  ] = value;
  editKey = "";
  scheduleSave();
  render();
}
function saveFocus() {
  const el = document.activeElement as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;
  return {
    id: el?.id,
    start: el && "selectionStart" in el ? el.selectionStart : null,
    end: el && "selectionEnd" in el ? el.selectionEnd : null,
    scroll: dom(".inspector-body")?.scrollTop || 0,
    editorScroll: dom(".card-editor-body")?.scrollTop || 0,
  };
}
function restoreFocus(f: ReturnType<typeof saveFocus>) {
  const el = f.id ? (document.getElementById(f.id) as HTMLInputElement) : null;
  if (el) {
    el.focus({ preventScroll: true });
    if (f.start != null && ["INPUT", "TEXTAREA"].includes(el.tagName))
      try {
        el.setSelectionRange(f.start, f.end);
      } catch {}
  }
  const body = dom(".inspector-body");
  if (body) body.scrollTop = f.scroll;
  const editor = dom(".card-editor-body");
  if (editor) editor.scrollTop = f.editorScroll;
}
function render() {
  if (editing && (!card() || selected !== editing)) editing = null;
  const focus = saveFocus();
  dom("#app")!.innerHTML =
    `<div class="app-shell ${detailsOpen && card() ? "with-details" : ""}">${sidebar()}<main class="main">${mainHead()}${toolbar()}${mainContent()}</main>${detailsOpen && card() ? `<aside class="inspector">${inspector()}</aside>` : ""}</div>`;
  renderGraph();
  restoreFocus(focus);
}
function sidebar() {
  const p = project(),
    cards = activeCards(p),
    review = cards.filter((c) => c.needsReview).length;
  return `<aside class="sidebar"><div class="brand"><div class="brand-mark">${icon("graph")}</div><div><div class="brand-name">思序</div><div class="brand-en">MINDTRACE</div></div></div><div class="workspace-pill"><div class="avatar">${icon("user")}</div><div class="grow">我的思考空间<div class="small muted" style="margin-top:3px">个人工作区</div></div><span class="small muted">本地</span></div><div class="side-caption">我的项目${iconBtn("new-project", "新建项目", "plus")}</div><div class="project-list">${state.projects.map((item) => `<button class="project-item ${p.id === item.id ? "active" : ""}" data-action="project" data-id="${e(item.id)}">${icon("folder")}<span class="project-title">${e(item.title)}</span></button>`).join("")}</div><div class="side-caption">工作区</div>${[
    ["map", "graph", "思考画布", cards.length],
    [
      "library",
      "book",
      "资料库",
      cards.filter((c) => c.type === "evidence").length,
    ],
    ["review", "clock", "待复核", review],
    ["prd", "doc", "产品文档", p.documents.length],
  ]
    .map(
      ([v, i, t, n]) =>
        `<button class="nav-item ${view === v ? "active" : ""}" data-action="view" data-view="${v}">${icon(String(i))}${t}<span class="nav-count">${n || ""}</span></button>`,
    )
    .join(
      "",
    )}<div class="sidebar-spacer"></div><div class="side-note">让想法自由生长，<br>也让每一个决定有迹可循。</div><div class="sidebar-bottom">${btn("import-file", "导入资料", "upload", "nav-item")}${btn("trash", "回收站", "trash", `nav-item ${view === "trash" ? "active" : ""}`)}${btn("settings", "AI 设置", "settings", "nav-item")}<div class="sidebar-footer"><span>思序 0.2</span><span>${window.mindtrace ? "macOS · 本地优先" : "浏览器预览"}</span></div></div></aside>`;
}
function mainHead() {
  const p = project();
  return `<header class="main-head"><div class="breadcrumb">我的项目 ${icon("chevron")} <span>${e(p.title)}</span></div><div class="row between"><h1>${e(p.title)}</h1><div class="row head-actions">${iconBtn("project-menu", "项目操作", "more")}${btn("ai", "AI 助手", "spark", "secondary")}</div></div><div class="row between" style="margin-top:6px"><p class="project-goal">${e(p.goal || "从一个问题开始，记录你的思考。")}</p><button class="linkish" data-action="retry-save"><span class="save-label"><span class="save-dot ${saveFailed ? "error" : ""}"></span>${saveFailed ? "保存失败" : dirty ? "保存中" : "已保存到本机"}</span></button></div></header>`;
}
function toolbar() {
  return `<div class="toolbar"><div class="view-tabs">${[
    ["map", "graph", "脑图"],
    ["cards", "grid", "卡片"],
    ["prd", "doc", "PRD"],
  ]
    .map(([v, i, t]) =>
      btn("view", t, i, view === v ? "active" : "", `data-view="${v}"`),
    )
    .join("")}</div><div class="toolbar-right">${
    view === "prd"
      ? `${btn("generate-prd", "生成 PRD", "spark", "secondary")}${documentCurrent() ? iconBtn("export-prd", "导出 Markdown", "download") : ""}`
      : `<select class="filter-select" id="filter-select" aria-label="筛选卡片">${option("all", "全部卡片", filter)}${Object.entries(
          TYPES,
        )
          .map(([k, t]) => option(k, t.name, filter))
          .join("")}${JUDGMENTS.slice(1)
          .map((j) => option(j, j, filter))
          .join("")}${CHOICES.slice(1)
          .map((j) => option(j, j, filter))
          .join(
            "",
          )}</select><label class="search">${icon("search")}<input id="search-input" placeholder="搜索想法…" aria-label="搜索卡片" value="${e(query)}"></label>${btn("new-card", "新建卡片", "plus", "primary")}`
  }</div></div>`;
}
function mainContent() {
  if (view === "prd") return prdView();
  if (view === "trash") return trashView();
  if (["cards", "library", "review"].includes(view)) return listView();
  return `<div class="canvas-wrap" id="canvas"><div class="canvas-topnote">${icon("graph")}点击文字直接编辑 · 拖动卡片顶部移动 · 空白处拖动画布</div><div class="graph-world" id="world"></div><div class="canvas-bottom"><div class="legend">${Object.values(
    TYPES,
  )
    .map(
      (t) =>
        `<span class="legend-item"><i class="legend-dot" style="--type-color:${t.color}"></i>${t.name}</span>`,
    )
    .join(
      "",
    )}</div><div class="zoom-controls">${iconBtn("zoom-out", "缩小", "minus")}<span class="zoom-value">${Math.round(transform.z * 100)}%</span>${iconBtn("zoom-in", "放大", "plus")}<span class="divider"></span>${iconBtn("fit", "适应画布", "fit")}</div></div></div>`;
}
function cardStatus(c: Card) {
  if (c.needsReview) return "待复核";
  if (c.type === "judgment") return c.conclusion;
  if (c.type === "decision") return c.confirmed ? "已确认" : "决策草稿";
  if (c.type === "validation") return c.progress;
  return c.origin === "AI 生成"
    ? "AI 建议"
    : c.type === "evidence"
      ? "有来源可追溯"
      : "继续探索";
}
function inlineKeys(c: Card) {
  return [
    "body",
    ...(c.type === "judgment"
      ? ["rationale", "conditions"]
      : c.type === "decision"
        ? ["rationale", "scope"]
        : c.type === "evidence"
          ? ["source"]
          : c.type === "validation"
            ? ["method", "criteria", "result"]
            : []),
  ];
}
function editorHeight(c: Card) {
  return Math.min(
    ["judgment", "decision", "validation"].includes(c.type)
      ? 500
      : c.type === "evidence"
        ? 460
        : 420,
    Math.max(280, window.innerHeight - 290),
  );
}
function graphNodes() {
  return layout(project(), filter, query, (c) =>
    c.id === editing
      ? { width: 360, height: editorHeight(c) }
      : { width: 280, height: 200 },
  );
}
function choicesField(c: Card) {
  return `<div class="card-choices"><h3 class="mini-heading">备选方案与选择结果</h3>${
    activeCards(project())
      .filter((i) => i.type === "idea")
      .map(
        (i) =>
          `<div class="choice-row"><label for="choice-${i.id}">${e(i.title)}</label><select id="choice-${i.id}" data-choice="${i.id}">${CHOICES.map((v) => option(v, v, c.choices[i.id] || "未决定")).join("")}</select></div>`,
      )
      .join("") || '<p class="field-hint">先添加想法卡，再比较与选择。</p>'
  }</div>`;
}
function inlineField(c: Card, name: string, label: string, kind = "textarea") {
  if (name === "body")
    return `<div class="inline-field rich-field"><div class="rich-toolbar"><span>${e(label)}</span><div class="row">${btn("insert-image", "图片", "image", "", `data-id="${c.id}" title="插入图片，也可直接粘贴图片"`)}${btn("insert-link", "链接", "link", "", `data-id="${c.id}" title="选中文字添加超链接 · ⌘K"`)}</div></div><div id="inline-body" class="rich-body" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${e(label)}" data-rich-body data-card-id="${c.id}" data-placeholder="写下内容，或粘贴图片和链接…">${richBody(c, project().attachments)}</div></div>`;
  const attrs = `id="inline-${name}" data-field="${name}" data-card-id="${c.id}" aria-label="${e(label)}"`;
  return `<label class="inline-field"><span>${e(label)}</span>${kind === "input" ? `<input ${attrs} value="${e(c[name])}" placeholder="填写${e(label)}…">` : `<textarea ${attrs} rows="${name === "body" ? 3 : 2}" placeholder="填写${e(label)}…">${e(c[name])}</textarea>`}</label>`;
}
function cardSurface(c: Card, onMap: boolean) {
  const isEditing = editing === c.id;
  const data = `data-id="${c.id}"`;
  const imageId = c.bodyHtml
    ? new DOMParser()
        .parseFromString(c.bodyHtml, "text/html")
        .querySelector("img[data-image-id]")
        ?.getAttribute("data-image-id")
    : null;
  const thumbnail = project().attachments.find(
    (a) => a.id === imageId && a.mime,
  );
  const header = `<div class="node-label" ${onMap ? 'data-drag-handle title="拖动顶部移动卡片；按住 ⌥ 拖到另一张卡片可调整层级"' : ""}>${icon(TYPES[c.type].icon)}<span>${TYPES[c.type].name}</span>${onMap ? '<span class="drag-grip" aria-hidden="true">⠿</span>' : ""}<span class="grow"></span><span class="card-confirm-state">${c.needsReview ? "待复核" : c.confirmed ? "已确认" : "草稿"}</span>${iconBtn("card-menu", "卡片操作", "more", data)}</div>`;
  if (!isEditing)
    return `${header}<button class="node-title" data-action="edit-card" ${data} data-edit-field="title" title="点击编辑标题">${e(c.title || "未命名卡片")}</button><div class="node-preview-content"><div role="button" tabindex="0" class="node-summary ${!c.body ? "placeholder" : ""}" data-action="edit-card" ${data} data-edit-field="body" title="点击编辑内容">${richBody(c, project().attachments, true) || e((c.type === "evidence" ? c.excerpt?.slice(0, 150) : "") || "点击记录内容…")}</div>${thumbnail ? `<button class="node-thumbnail" data-action="preview-image" data-id="${e(thumbnail.id)}" data-card-id="${e(c.id)}" title="查看图片"><img src="data:${thumbnail.mime};base64,${e(thumbnail.data)}" alt="${e(thumbnail.name)}"></button>` : ""}</div><div class="node-footer"><span class="card-status">${e(cardStatus(c))}</span><div class="row">${iconBtn("child", "添加子卡片", "plus", data)}${btn("show-details", "详情", "", "card-details-link", data)}</div></div>`;
  return `${header}<div class="card-editor-body">${c.needsReview ? '<div class="review-banner">关联依据已变化，请复核内容与理由。</div>' : ""}${inlineField(c, "title", "卡片标题", "input")}${c.type === "judgment" ? `<label class="inline-field"><span>判断结论</span><select id="inline-conclusion" data-field="conclusion" data-card-id="${c.id}">${JUDGMENTS.map((v) => option(v, v, c.conclusion)).join("")}</select></label>` : ""}${
    c.type === "validation"
      ? `<div class="inline-pair">${[
          ["progress", "验证进度", ["未开始", "进行中", "已结束"]],
          ["outcome", "验证结果", ["结果不确定", "通过", "未通过"]],
        ]
          .map(
            ([key, label, values]) =>
              `<label class="inline-field"><span>${label}</span><select id="inline-${key}" data-field="${key}" data-card-id="${c.id}">${(values as string[]).map((v) => option(v, v, c[key as string])).join("")}</select></label>`,
          )
          .join("")}</div>`
      : ""
  }${TYPES[c.type].fields
    .filter(([k]) => inlineKeys(c).includes(k))
    .map(([k, label]) =>
      inlineField(c, k, label, k === "source" ? "input" : "textarea"),
    )
    .join(
      "",
    )}${c.type === "decision" ? choicesField(c) : ""}<div class="inline-supplement">${btn("show-details", "更多字段、关联与历史", "", "linkish", data)}</div></div><div class="card-editor-foot"><div class="row">${iconBtn("child", "添加子卡片", "plus", data)}${iconBtn("ai", "AI 帮我思考", "spark", data)}</div><div class="row">${["judgment", "decision"].includes(c.type) ? btn("confirm-card", c.confirmed ? (c.needsReview ? "确认已复核" : "已确认") : "确认" + TYPES[c.type].name, "check", "secondary", data) : ""}${btn("finish-edit", "完成", "", "primary", data)}</div></div>`;
}
function revealEditor() {
  const c = graphNodes().find((n) => n.id === editing),
    bounds = dom("#canvas")?.getBoundingClientRect();
  if (!c || !bounds) return;
  const z = Math.min(1.15, Math.max(0.9, transform.z));
  // Keep this card anchored while bringing its fields into readable view.
  transform.x += c.x * (transform.z - z);
  transform.y += c.y * (transform.z - z);
  transform.z = z;
  const left = transform.x + c.x * z,
    top = transform.y + c.y * z;
  transform.x +=
    Math.max(24, Math.min(left, bounds.width - c.width * z - 24)) - left;
  transform.y +=
    Math.max(46, Math.min(top, bounds.height - c.height * z - 62)) - top;
  applyTransform();
}
function beginEditing(id: string, field = "title") {
  const target = project().cards.find((c) => c.id === id && !c.deleted);
  if (!target) return;
  if (editing !== id) {
    const previous = graphNodes().find((n) => n.id === id);
    selected = id;
    editing = id;
    detailsOpen = false;
    editKey = "";
    render();
    const next = graphNodes().find((n) => n.id === id);
    if (previous && next) {
      transform.x += (previous.x - next.x) * transform.z;
      transform.y += (previous.y - next.y) * transform.z;
    }
    revealEditor();
  }
  const input = dom<HTMLInputElement | HTMLTextAreaElement>(`#inline-${field}`);
  input?.focus({ preventScroll: true });
  if (view !== "map")
    dom(".list-card.editing")?.scrollIntoView({ block: "nearest" });
}
function finishEditing() {
  if (!editing) return;
  const id = editing,
    before = graphNodes().find((n) => n.id === id);
  editing = null;
  editKey = "";
  render();
  const after = graphNodes().find((n) => n.id === id);
  if (before && after) {
    transform.x += (before.x - after.x) * transform.z;
    transform.y += (before.y - after.y) * transform.z;
    applyTransform();
  }
  dom<HTMLElement>(`[data-card="${id}"] .node-title`)?.focus({
    preventScroll: true,
  });
}
function rememberRichRange() {
  const selection = window.getSelection();
  const body = dom("[data-rich-body]");
  if (
    body &&
    selection?.rangeCount &&
    body.contains(selection.anchorNode) &&
    body.contains(selection.focusNode)
  )
    richRange = selection.getRangeAt(0).cloneRange();
}
function restoreRichRange() {
  const body = dom("[data-rich-body]");
  if (!body) return;
  body.focus({ preventScroll: true });
  const selection = window.getSelection()!;
  const range =
    richRange && body.contains(richRange.commonAncestorContainer)
      ? richRange
      : document.createRange();
  if (range !== richRange) {
    range.selectNodeContents(body);
    range.collapse(false);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}
function syncRichBody() {
  const body = dom("[data-rich-body]");
  if (!body) return;
  const bodyHtml = cleanRichHTML(body.innerHTML, project().attachments);
  edit(body.dataset.cardId!, { body: richText(bodyHtml), bodyHtml });
  refreshEditedCard();
  rememberRichRange();
}
function insertRich(html: string) {
  restoreRichRange();
  document.execCommand("insertHTML", false, html);
  syncRichBody();
}
async function addImages(files: File[], target = imageTarget) {
  if (!target || !files.length) return;
  if (files.length > 10) throw new Error("一次最多插入 10 张图片");
  const attachments = await Promise.all(files.map(imageAttachment));
  if (
    project().id !== target.projectId ||
    !project().cards.some((c) => c.id === target.cardId && !c.deleted)
  )
    throw new Error("原卡片已切换或删除，请重新插入图片");
  // Do not move an asynchronous paste into a different card or modal.
  if (selected !== target.cardId || modal)
    throw new Error("当前卡片已切换，请回到原卡片重新插入图片");
  beginEditing(target.cardId, "body");
  mutate((p) => p.attachments.push(...attachments), false);
  insertRich(
    attachments
      .map(
        (a) =>
          cleanRichHTML(
            `<img data-image-id="${a.id}">`,
            project().attachments,
            true,
          ) + "<br>",
      )
      .join(""),
  );
  dom(".rich-body img:last-of-type")?.scrollIntoView({ block: "nearest" });
  toast(`已插入 ${attachments.length} 张图片，随项目自动保存`);
}
function renderGraph() {
  const world = dom("#world");
  if (!world) return;
  const nodes = graphNodes();
  if (!nodes.length) {
    world.innerHTML = "";
    dom("#canvas")!.insertAdjacentHTML(
      "afterbegin",
      `<div class="empty-canvas">${icon("graph")}<h2>${query || filter !== "all" ? "没有匹配的卡片" : "从一个问题开始"}</h2><p>写下需求，把每个想法、判断和选择连接起来。</p>${btn("new-card", "创建第一张卡片", "plus", "primary")}</div>`,
    );
    return;
  }
  world.innerHTML = `<svg class="edges" aria-hidden="true">${edgeHTML(nodes)}</svg>${nodes.map((c) => `<article class="node ${c.type} ${c.id === selected ? "selected" : ""} ${c.id === editing ? "editing" : ""} ${c.dim ? "dim" : ""}" data-card="${c.id}" data-node="${c.id}" aria-label="${e(TYPES[c.type].name + "：" + c.title)}" style="left:${c.x}px;top:${c.y}px;width:${c.width}px;height:${c.height}px;--type-color:${TYPES[c.type].color}">${cardSurface(c, true)}${c.children ? `<button class="node-collapse" data-action="collapse" data-id="${e(c.id)}" aria-label="${c.collapsed ? "展开" : "折叠"}分支">${c.collapsed ? c.children : "−"}</button>` : ""}</article>`).join("")}`;
  applyTransform();
}
function edgeHTML(nodes: ReturnType<typeof layout>) {
  const byId = new Map(nodes.map((c) => [c.id, c]));
  const curve = (a, b) =>
    `M ${a.x + a.width} ${a.y + 60} C ${a.x + a.width + 32} ${a.y + 60}, ${b.x - 32} ${b.y + 60}, ${b.x} ${b.y + 60}`;
  return (
    nodes
      .filter((c) => c.parentId && byId.has(c.parentId))
      .map(
        (c) => `<path class="edge" d="${curve(byId.get(c.parentId!)!, c)}"/>`,
      )
      .join("") +
    project()
      .links.filter((l) => byId.has(l.from) && byId.has(l.to))
      .map((l) => {
        const a = byId.get(l.from)!,
          b = byId.get(l.to)!;
        return `<path class="edge cross" d="M ${a.x + a.width / 2} ${a.y + a.height} C ${a.x + a.width / 2} ${a.y + a.height + 40}, ${b.x + b.width / 2} ${b.y - 45}, ${b.x + b.width / 2} ${b.y}"/><text class="edge-label" x="${(a.x + b.x) / 2 + a.width / 2}" y="${(a.y + b.y) / 2 + 47}">${e(l.type)}</text>`;
      })
      .join("")
  );
}
function applyTransform() {
  const world = dom("#world");
  if (world)
    world.style.transform = `translate(${transform.x}px,${transform.y}px) scale(${transform.z})`;
  document
    .querySelectorAll(".zoom-value")
    .forEach((n) => (n.textContent = `${Math.round(transform.z * 100)}%`));
}
function fit() {
  const bounds = dom("#canvas")?.getBoundingClientRect(),
    nodes = graphNodes();
  if (!bounds || !nodes.length) return;
  const minX = Math.min(...nodes.map((n) => n.x)),
    minY = Math.min(...nodes.map((n) => n.y)),
    maxX = Math.max(...nodes.map((n) => n.x + n.width)),
    maxY = Math.max(...nodes.map((n) => n.y + n.height));
  const z = Math.max(
    0.35,
    Math.min(
      1.1,
      (bounds.width - 80) / (maxX - minX),
      (bounds.height - 130) / (maxY - minY),
    ),
  );
  transform = {
    z,
    x: (bounds.width - (maxX - minX) * z) / 2 - minX * z,
    y: (bounds.height - (maxY - minY) * z) / 2 - minY * z,
  };
  applyTransform();
}
function listView() {
  let cards = activeCards(project());
  if (view === "library") cards = cards.filter((c) => c.type === "evidence");
  if (view === "review") cards = cards.filter((c) => c.needsReview);
  const hits = new Set(
    layout(project(), filter, query)
      .filter((c) => !c.dim)
      .map((c) => c.id),
  );
  cards = cards.filter((c) => hits.has(c.id));
  return `<div class="list-view"><div class="collection-label">${view === "library" ? "资料库" : view === "review" ? "待复核内容" : "所有卡片"} · ${cards.length} 张</div><div class="list-grid">${cards.map((c) => `<article class="list-card ${selected === c.id ? "selected" : ""} ${editing === c.id ? "editing" : ""}" data-card="${c.id}" style="--type-color:${TYPES[c.type].color}">${cardSurface(c, false)}</article>`).join("") || '<p class="muted">这里还没有卡片。</p>'}</div></div>`;
}
function trashView() {
  const cards = project().cards.filter((c) => c.deleted);
  return `<div class="list-view"><div class="collection-label">回收站 · ${cards.length} 张卡片</div>${cards.map((c) => `<div class="trash-card">${icon(TYPES[c.type].icon)}<div><h3>${e(c.title)}</h3><p>原有引用与历史仍保留</p></div>${btn("restore-card", "恢复", "restore", "secondary", `data-id="${e(c.id)}"`)}</div>`).join("") || '<p class="muted">回收站是空的。</p>'}</div>`;
}
function field(name: string, label: string, value: unknown, kind = "textarea") {
  return `<label class="field"><span class="field-label">${e(label)}</span>${kind === "input" ? `<input id="field-${name}" data-field="${name}" value="${e(value)}">` : `<textarea id="field-${name}" data-field="${name}" ${name === "excerpt" ? 'class="long"' : ""} placeholder="记录${e(label)}…">${e(value)}</textarea>`}</label>`;
}
function inspector() {
  const c = card();
  if (!c)
    return `<div class="welcome-inspector">${icon("graph")}<h3>选中一张卡片，继续思考</h3><p>在这里补充内容、连接资料，或记录你的判断与选择。</p><div class="divider-line"></div><p class="small">卡片可以随时保存为草稿。<br>不必一次想清楚所有问题。</p></div>`;
  const t = TYPES[c.type];
  return `<div class="inspector-head"><div class="inspector-topline"><span class="eyebrow">CARD DETAILS</span>${iconBtn("hide-details", "关闭详情", "close")}</div><div class="kind-pill" style="--type-color:${t.color};margin-bottom:10px">${icon(t.icon)}${t.name}卡片</div><h2 class="inspector-title">${e(c.title)}</h2><div class="detail-meta"><span class="state-chip ${c.needsReview ? "review" : ""}">${c.needsReview ? "待复核" : c.confirmed ? "已确认 · v" + c.revision : "草稿"}</span><span>${e(c.origin)}</span></div></div><div class="detail-tabs">${[
    ["content", "补充资料"],
    ["relations", "关联"],
    ["history", "历史"],
  ]
    .map(([k, l]) =>
      btn(
        "detail-tab",
        l,
        "",
        detailTab === k ? "active" : "",
        `data-tab="${k}"`,
      ),
    )
    .join(
      "",
    )}</div><div class="inspector-body">${detailTab === "content" ? cardFields(c) : detailTab === "relations" ? relations(c) : cardHistory(c)}</div><div class="inspector-bottom">${btn("child", "添加子卡片", "plus", "secondary")}${c.type === "judgment" || c.type === "decision" ? btn("confirm-card", c.confirmed ? (c.needsReview ? "确认已复核" : "已确认") : "确认" + t.name, "check", "primary") : btn("ai", "AI 帮我思考", "spark", "secondary")}</div>`;
}
function cardFields(c: Card) {
  return `<p class="field-hint">标题、正文和主要理由在卡片上直接编辑。</p>${btn("edit-card", "回到卡片编辑", "arrow", "secondary spaced", `data-id="${c.id}"`)}<div class="divider-line"></div>${TYPES[
    c.type
  ].fields
    .filter(([k]) => !inlineKeys(c).includes(k))
    .map(([k, label]) =>
      field(
        k,
        label,
        c[k],
        ["sourceDate", "location", "dimension", "audience"].includes(k)
          ? "input"
          : "textarea",
      ),
    )
    .join(
      "",
    )}${c.type === "evidence" ? `<div class="row spaced">${/^https?:\/\//.test(c.source || "") ? btn("open-source", "打开来源", "external", "secondary") : ""}${c.attachmentId ? btn("open-attachment", "打开附件", "book", "secondary") : ""}</div><p class="field-hint spaced">原文摘录与摘要独立保存。${c.sourceKind === "检索摘要" ? "当前为检索摘要，尚未读取完整页面。" : ""}</p>` : ""}<div class="divider-line"></div><label class="field"><span class="field-label">所在分支 / 判断对象</span><select id="parent-select" data-parent="true">${option("", "独立卡片", c.parentId || "")}${activeCards(
    project(),
  )
    .filter((n) => n.id !== c.id)
    .map((n) =>
      option(n.id, `${TYPES[n.type].name} · ${n.title}`, c.parentId || ""),
    )
    .join("")}</select></label>`;
}

function relations(c: Card) {
  const links = project().links.filter((l) => l.from === c.id || l.to === c.id);
  return `<p class="collapse-note">关联保留推理过程。同一份资料可以支持或反驳多个判断。</p>${c.parentId ? `<h3 class="mini-heading spaced">所在分支</h3>${btn("go-card", e(project().cards.find((n) => n.id === c.parentId)?.title || "已删除的卡片"), "graph", "secondary", `data-id="${c.parentId}"`)}` : ""}<div class="divider-line"></div><h3 class="mini-heading">明确关联 · ${links.length}</h3>${links
    .map((l) => {
      const other = project().cards.find(
        (n) => n.id === (l.from === c.id ? l.to : l.from),
      );
      return `<div class="relation-row"><div class="relation-text"><div class="relation-tag">${l.from === c.id ? "本卡片 →" : "→ 本卡片"} ${e(l.type)}</div>${btn("go-card", e(other?.title || "不存在的卡片"), "", "linkish", `data-id="${e(other?.id)}"`)}${other?.deleted ? '<div class="small muted">来源已删除</div>' : ""}</div>${iconBtn("unlink", "移除关联", "close", `data-id="${l.id}"`)}</div>`;
    })
    .join(
      "",
    )}<div class="divider-line"></div><h3 class="mini-heading">建立新关联</h3><label class="field"><span class="field-label">本卡片对另一张卡片</span><select id="relation-type">${RELATIONS.map((v) => option(v, v, "参考")).join("")}</select></label><label class="field"><span class="field-label">关联到</span><select id="relation-target">${activeCards(
    project(),
  )
    .filter((n) => n.id !== c.id)
    .map((n) => option(n.id, n.title, ""))
    .join(
      "",
    )}</select></label>${btn("add-link", "添加关联", "link", "secondary")}`;
}
function cardHistory(c: Card) {
  return `<p class="collapse-note">修改已确认内容时，旧版本会保存在这里。当前修订不会覆盖历史依据。</p><div class="divider-line"></div>${
    [...c.history]
      .reverse()
      .map(
        (h) =>
          `<div class="history-item"><div class="row between"><strong>确认版本 v${h.content.revision}</strong><span class="muted small">${e(new Date(h.at).toLocaleDateString("zh-CN"))}</span></div><pre>${e(h.content.title)}\n\n${e(h.content.body)}${h.content.rationale ? "\n\n理由：" + e(h.content.rationale) : ""}${h.content.conditions ? "\n\n成立条件：" + e(h.content.conditions) : ""}</pre></div>`,
      )
      .join("") || '<p class="readonly-note">还没有历史确认版本。</p>'
  }`;
}
function prdView() {
  const d = documentCurrent();
  if (!d)
    return `<div class="empty-canvas"><div class="empty-art">${icon("doc")}</div><h2>把思考，整理成产品方案</h2><p>从你选定的需求和已确认决策出发。<br>保留依据，将尚未解决的问题明确列出。</p>${btn("generate-prd", "生成第一份 PRD", "spark", "primary")}</div>`;
  return `<div class="prd-view"><div class="row between" style="max-width:880px;margin:0 auto 15px"><select id="document-version" class="filter-select" aria-label="文档版本">${project()
    .documents.map((doc) =>
      option(doc.id, `版本 ${doc.version} · ${formatDate(doc.created)}`, d.id),
    )
    .join(
      "",
    )}</select><div class="row">${btn("snapshot-document", "保存新版本", "plus", "secondary")}${btn("export-prd", "导出 Markdown", "download", "secondary")}</div></div><article class="document">${d.needsReview ? '<div class="review-banner">部分依据已变化。这份文档保留了生成时的快照，请复核相关章节。</div>' : ""}<header><div class="eyebrow">PRODUCT REQUIREMENTS DOCUMENT</div><h1>${e(project().title)}</h1><p class="small muted">草稿 · 版本 ${d.version} · ${formatDate(d.created)} · ${d.sources.length} 份依据</p></header>${d.sections
    .map(
      (s) =>
        `<section class="doc-section"><h2>${e(s.title)}</h2><textarea id="doc-${s.key}" data-doc-section="${s.key}" aria-label="${e(s.title)}" style="height:${Math.min(550, Math.max(120, s.text.split("\n").length * 23 + 35))}px">${e(s.text)}</textarea><div class="doc-refs">${d.sources
          .filter((src) => s.text.includes(src.id))
          .map((src) =>
            btn(
              "source-snapshot",
              e(src.title) + " · v" + src.revision,
              "link",
              "",
              `data-id="${e(src.id)}" data-revision="${src.revision}"`,
            ),
          )
          .join("")}</div></section>`,
    )
    .join("")}</article></div>`;
}

function openModal(kind: string, props: Record<string, unknown> = {}) {
  modal = { kind, error: "", ...props };
  renderModal();
  setTimeout(
    () =>
      dom<HTMLInputElement>("#modal-root input:not([type=checkbox])")?.focus(),
    30,
  );
}
function closeModal() {
  if (modal?.busy) {
    modal.cancelled = true;
    api("cancel", { id: modal.requestId }).catch(() => {});
  }
  modal = null;
  dom("#modal-root")!.innerHTML = "";
}
function modalInput(
  name: string,
  label: string,
  value: unknown,
  textarea = false,
  type = "text",
  placeholder = "",
) {
  return `<label class="field"><span class="field-label">${e(label)}</span>${textarea ? `<textarea id="modal-${name}" data-modal-field="${name}" placeholder="${e(placeholder)}">${e(value)}</textarea>` : `<input id="modal-${name}" data-modal-field="${name}" type="${type}" value="${e(value)}" placeholder="${e(placeholder)}" autocomplete="off">`}</label>`;
}
function renderModal() {
  if (!modal) {
    dom("#modal-root")!.innerHTML = "";
    return;
  }
  const m = modal;
  let title = "",
    sub = "",
    body = "",
    foot = "",
    wide = false;
  if (m.kind === "new-project" || m.kind === "edit-project") {
    title = m.kind === "new-project" ? "创建一个思考项目" : "项目设置";
    sub = "一个项目，容纳一个问题的全部思考。";
    body =
      modalInput("title", "项目名称", m.title) +
      modalInput("goal", "项目目标", m.goal, true);
    foot = btn("save-project", "保存项目", "check", "primary");
  }
  if (m.kind === "new-card") {
    title = "记录新的思考";
    sub = "先记下来，之后再补充内容和依据。";
    body = `<div class="type-grid">${Object.entries(TYPES)
      .map(
        ([key, t]) =>
          `<button class="type-option ${m.type === key ? "active" : ""}" style="--type-color:${t.color}" data-action="new-card-type" data-type="${key}">${icon(t.icon)}<span>${t.name}</span></button>`,
      )
      .join(
        "",
      )}</div>${modalInput("title", "卡片标题", m.title)}${modalInput("body", "先记下你的想法", m.body, true)}<label class="field"><span class="field-label">添加到</span><select id="modal-parentId" data-modal-field="parentId">${option("", "独立卡片", m.parentId || "")}${activeCards(
      project(),
    )
      .map((c) => option(c.id, c.title, m.parentId || ""))
      .join("")}</select></label>`;
    foot = btn("create-card", "创建卡片", "plus", "primary");
  }
  if (m.kind === "link") {
    title = "添加超链接";
    body =
      modalInput(
        "label",
        "显示文字",
        m.label,
        false,
        "text",
        "例如：参考资料",
      ) + modalInput("url", "链接地址", m.url, false, "url", "https://…");
    foot = btn("apply-link", "插入链接", "link", "primary");
  }
  if (m.kind === "image") {
    const asset = project().attachments.find((a) => a.id === m.imageId);
    title = asset?.name || "图片";
    wide = true;
    if (asset?.mime)
      body = `<img class="image-preview" src="data:${asset.mime};base64,${e(asset.data)}" alt="${e(asset.name)}">`;
    foot =
      btn("remove-image", "从正文移除", "trash", "secondary") +
      btn("copy-image", "复制图片", "image", "primary");
  }
  if (m.kind === "project-menu") {
    title = "项目操作";
    body = `<div class="stack">${btn("edit-project", "编辑项目名称与目标", "folder", "secondary")}${btn("export-project", "导出项目备份", "download", "secondary")}${btn("import-project", "导入项目备份", "upload", "secondary")}${btn("reveal-data", "打开本地数据目录", "folder", "secondary")}${btn("new-project", "创建新项目", "plus", "secondary")}</div>`;
  }
  if (m.kind === "card-menu") {
    title = "卡片操作";
    body = `<div class="stack">${btn("duplicate-card", "复制为独立卡片", "grid", "secondary")}${btn("detach-card", "移出当前分支", "graph", "secondary")}${btn("delete-card", "移入回收站", "trash", "secondary danger")}</div><p class="field-hint spaced">删除卡片会保留历史和引用，之后可以在回收站恢复。</p>`;
  }
  if (m.kind === "settings") {
    title = "连接你的 AI";
    sub = "配置后，AI 可以围绕选中的卡片思考和整理。";
    body = `<div class="api-presets">${btn("preset", "DeepSeek", "", "", `data-endpoint="https://api.deepseek.com/chat/completions"`)}${btn("preset", "本地 Ollama", "", "", `data-endpoint="http://localhost:11434/v1/chat/completions"`)}</div>${modalInput("endpoint", "完整 Chat Completions 接口地址", m.endpoint, false, "url", "https://服务地址/v1/chat/completions")}${modalInput("model", "模型名称", m.model, false, "text", "填写服务提供的模型名称")}${modalInput("apiKey", settings.hasKey ? "API Key · 已保存，留空保留" : "API Key（本地服务可留空）", "", false, "password")}<label class="checkbox-row"><input type="checkbox" data-modal-field="clear_ai" ${m.clear_ai ? "checked" : ""}>清除已保存的模型密钥</label><div class="divider-line"></div><h3 class="mini-heading">联网寻找资料</h3>${modalInput("searchKey", settings.hasSearchKey ? "Tavily Key · 已保存，留空保留" : "Tavily 检索密钥", "", false, "password")}<label class="checkbox-row"><input type="checkbox" data-modal-field="clear_search" ${m.clear_search ? "checked" : ""}>清除检索密钥</label><p class="field-hint spaced">密钥经过 macOS 加密后保存在本机，不进入项目备份。更换模型接口地址后，需要重新填写该服务的密钥。</p>`;
    foot = btn("save-settings", "保存设置", "check", "primary");
  }
  if (m.kind === "import-options") {
    title = "把资料带进来";
    sub = "原文与摘要分别保存，保留信息的来处。";
    body = `<div class="stack">${btn("pick-file", "导入 PDF / Markdown / 文本", "upload", "secondary")}${btn("import-url", "读取网页链接", "link", "secondary")}${btn("new-note", "手动记录资料", "book", "secondary")}${btn("research", "联网寻找资料", "search", "secondary")}</div>`;
  }
  if (m.kind === "url") {
    title = "读取网页资料";
    body =
      modalInput("url", "网页地址", m.url, false, "url", "https://…") +
      '<p class="field-hint">公开页面可提取文字。需要登录或动态加载的页面，可以粘贴原文。</p>';
    foot = m.busy
      ? '<span class="ai-status"><i class="spinner"></i>正在读取…</span>'
      : btn("fetch-url", "读取并创建资料卡", "download", "primary");
  }
  if (m.kind === "ai" || m.kind === "research") {
    wide = true;
    const research = m.kind === "research";
    title = research ? "围绕问题寻找资料" : "与你一起，把想法往前推";
    sub = research
      ? "检索真实来源，选择需要保留的资料。"
      : "选择本次上下文，AI 的建议由你决定是否采纳。";
    body = research
      ? modalInput("query", "你想研究什么？", m.query, true)
      : `<label class="field"><span class="field-label">这次想让 AI 做什么</span><select id="modal-task" data-modal-field="task">${[["idea", "发散想法"], ["requirement", "拆解需求"], ["judgment", "分析可行性"], ["decision", "比较与决策"], ...(card()?.type === "evidence" ? [["summary", "整理当前资料"]] : [])].map(([v, t]) => option(v, t, m.task)).join("")}</select></label><span class="field-label" style="margin-bottom:8px">本次发送的卡片 · ${m.context.length} 张</span><div class="context-list">${activeCards(
          project(),
        )
          .map(
            (c) =>
              `<label class="checkbox-row"><input type="checkbox" data-context="${c.id}" ${m.context.includes(c.id) ? "checked" : ""}><span>${e(TYPES[c.type].name)} · ${e(c.title)}</span></label>`,
          )
          .join(
            "",
          )}</div>${modalInput("instruction", "补充要求", m.instruction, true)}`;
    if (m.raw && !m.suggestions?.length)
      body += `<details><summary class="small muted">查看原始回答</summary><pre class="raw-output">${e(m.raw)}</pre></details>`;
    if (m.suggestions?.length)
      body += `<div class="divider-line"></div><h3 class="mini-heading">${research ? "找到的资料" : "AI 建议"} · ${m.suggestions.length}</h3>${m.suggestions.map((s: Suggestion) => `<div class="suggestion"><h3>${e(s.title)}</h3>${research ? `<p>${e(s.excerpt)}</p><div class="source-link">${e(s.source)}</div><p class="small muted">搜索摘要 · 尚未读取完整网页</p>` : `<textarea data-suggestion="${s.id}" aria-label="编辑 AI 建议">${e(s.body)}</textarea>${s.rationale ? `<p>理由：${e(s.rationale)}</p>` : ""}${s.conditions ? `<p>成立条件：${e(s.conditions)}</p>` : ""}`}<div class="row between"><span class="small muted">${research ? "有出处可核对" : "AI 草稿 · 需自行判断"}</span>${btn("accept-suggestion", s.accepted ? "已采纳" : "采纳建议", "check", "secondary", `data-id="${s.id}" ${s.accepted ? "disabled" : ""}`)}</div></div>`).join("")}`;
    foot = m.busy
      ? `<span class="ai-status grow"><i class="spinner"></i>${research ? "正在检索真实来源…" : "正在整理思路…"}</span>${btn("cancel-ai", "取消任务", "", "secondary")}`
      : `${research ? "" : btn("research", "寻找资料", "search", "secondary")}${btn(research ? "run-research" : "run-ai", m.suggestions?.length ? "重新生成" : research ? "开始检索" : "生成建议", "spark", "primary")}`;
  }
  if (m.kind === "prd-scope") {
    wide = true;
    title = "从确定的内容，生成 PRD";
    sub = "选择本次范围；资料和判断会随关联一起作为依据。";
    const eligible = activeCards(project()).filter(
      (c) => c.type === "requirement" || (c.type === "decision" && c.confirmed),
    );
    body = `<div class="onboarding-note">仅已确认的决策参与功能范围。缺失信息会列为待确认项；验证尚未完成时保留风险说明。</div><div class="context-list" style="max-height:320px">${eligible.map((c) => `<label class="checkbox-row"><input type="checkbox" data-prd-scope="${c.id}" ${m.scope.includes(c.id) ? "checked" : ""}><span>${e(TYPES[c.type].name)} · ${e(c.title)}${c.needsReview ? "（待复核）" : ""}</span></label>`).join("") || '<p class="muted">先创建需求或确认一项决策。</p>'}</div>`;
    foot = m.busy
      ? `<span class="ai-status grow"><i class="spinner"></i>正在整理文档…</span>${btn("cancel-ai", "取消任务", "", "secondary")}`
      : `${btn("prepare-prd-ai", "AI 辅助整理", "spark", "secondary")}${btn("prepare-prd", "生成结构化草稿", "doc", "primary")}`;
  }
  if (m.kind === "prd-preview") {
    wide = true;
    title = "检查并保存 PRD";
    sub = m.isAI
      ? "AI 生成的文字标记为草稿，请核对内容和依据。"
      : "勾选需要采用的章节。未勾选的章节保留现有内容。";
    const old = documentCurrent();
    body = m.proposal.sections
      .map((s: Section) => {
        const previous = old?.sections.find((v) => v.key === s.key);
        return `<div class="diff-section"><label class="checkbox-row"><input type="checkbox" data-prd-section="${s.key}" ${m.keys.includes(s.key) ? "checked" : ""}><strong>${e(s.title)}</strong></label>${previous ? `<div class="diff-columns"><div><span class="small muted">当前内容</span><pre>${e(previous.text)}</pre></div><div><span class="small muted">新草稿</span><pre>${e(s.text)}</pre></div></div>` : `<pre class="raw-output">${e(s.text)}</pre>`}</div>`;
      })
      .join("");
    foot = btn("save-prd", "保存为新版本", "check", "primary");
  }
  if (m.kind === "source-snapshot") {
    title = "文档引用的依据";
    const s: Source = m.source;
    sub = `${s.title} · v${s.revision} · 生成时的快照`;
    body = `<pre class="raw-output" style="max-height:none">${e(s.content.body)}${s.content.rationale ? "\n\n理由：" + e(s.content.rationale) : ""}${s.content.source ? "\n\n来源：" + e(s.content.source) : ""}${s.content.excerpt ? "\n\n摘录：" + e(s.content.excerpt) : ""}</pre>`;
    foot = btn(
      "go-card",
      "打开当前卡片",
      "arrow",
      "primary",
      `data-id="${s.id}"`,
    );
  }
  dom("#modal-root")!.innerHTML =
    `<div class="modal-shade"><section role="dialog" aria-modal="true" aria-labelledby="modal-heading" class="modal ${wide ? "wide" : ""}"><header class="modal-head"><div class="row between"><h2 id="modal-heading">${title}</h2>${iconBtn("close-modal", "关闭", "close")}</div>${sub ? `<p>${sub}</p>` : ""}</header>${m.busy ? '<div class="loading-bar"></div>' : ""}<div class="modal-body">${body}${m.error ? `<div class="error-box" role="alert">${e(m.error)}</div>` : ""}</div><footer class="modal-foot">${btn("close-modal", m.busy ? "关闭并取消" : "返回", "", "secondary")}${foot}</footer></section></div>`;
}
function newCard(type: CardType = "idea", parentId: string | null = selected) {
  openModal("new-card", { type, title: "", body: "", parentId });
}
function openAI() {
  const c = card();
  const ids = c
    ? sourceClosure(project(), [c.id]).map((n) => n.id)
    : activeCards(project())
        .filter((n) => n.type === "requirement")
        .map((n) => n.id);
  openModal("ai", {
    task: c?.type === "evidence" ? "summary" : "idea",
    context: ids,
    instruction: "",
    suggestions: [],
    parentId: c?.id || null,
  });
}
async function runAI(research = false) {
  const m = modal;
  if (m.busy) return;
  m.busy = true;
  m.error = "";
  m.cancelled = false;
  const requestId = uid();
  m.requestId = requestId;
  const current = () =>
    modal === m && m.requestId === requestId && !m.cancelled;
  renderModal();
  try {
    if (research) {
      const values = await api("search", { query: m.query, requestId });
      if (!current()) return;
      m.suggestions = values.map((v) => ({
        id: uid(),
        type: "evidence",
        title: v.title,
        body: "",
        excerpt: v.content,
        source: v.url,
        retrieved: true,
        sourceKind: "检索摘要",
        origin: "联网检索",
        accepted: false,
      }));
      if (!m.suggestions.length)
        m.error = "没有检索到可用资料，请调整问题后重试。";
    } else {
      const context = activeCards(project())
        .filter((c) => m.context.includes(c.id))
        .map((c) => {
          const { history, ...value } = c;
          return value;
        });
      if (!context.length) throw new Error("请选择至少一张上下文卡片");
      const contextText = JSON.stringify(context);
      if (contextText.length > 120000)
        throw new Error("所选资料过长，请缩小上下文或保留关键摘录");
      const summary = m.task === "summary";
      const instruction = summary
        ? "忠实总结所给资料，明确区分原文事实与推测，不发明来源。用简洁中文输出摘要。"
        : `你是产品思考助手。输出合法 JSON 对象 {"cards":[{"title":"标题","body":"描述","rationale":"理由","conditions":"条件","assumptions":"假设","questions":"待研究问题","conclusion":"可行/有条件可行/不可行/证据不足"}]}，给出 2 到 4 张${TYPES[m.task as CardType].name}建议卡。只使用提供的资料。无法证实的内容标为假设或待验证。不得伪造检索结果或引用。决策建议不代表用户已确认。`;
      const raw = await api("ai", {
        requestId,
        messages: [
          { role: "system", content: instruction },
          {
            role: "user",
            content: `项目：${project().title}\n目标：${project().goal}\n上下文：${contextText}\n补充要求：${m.instruction}`,
          },
        ],
      });
      if (!current()) return;
      m.raw = raw;
      if (summary) {
        m.suggestions = [
          {
            id: uid(),
            type: "evidence",
            title: "资料摘要建议",
            body: raw,
            applyTo: m.parentId,
            accepted: false,
          },
        ];
      } else m.suggestions = parseSuggestions(raw, m.task);
    }
  } catch (error) {
    if (current()) m.error = (error as Error).message;
  } finally {
    if (m.requestId === requestId) {
      m.busy = false;
      if (modal === m) renderModal();
    }
  }
}
async function preparePRD(useAI = false) {
  const m = modal;
  if (m.busy) return;
  if (!m.scope.length) throw new Error("请选择至少一条需求或一项已确认决策");
  let proposal = prdSections(project(), m.scope);
  const requestId = uid();
  if (useAI) {
    m.busy = true;
    m.requestId = requestId;
    m.cancelled = false;
    m.error = "";
    renderModal();
    try {
      const payload = JSON.stringify(proposal);
      if (payload.length > 140000)
        throw new Error("范围内的资料过长，请缩小本次范围");
      const raw = await api("ai", {
        requestId,
        messages: [
          {
            role: "system",
            content:
              '你是 PRD 编辑助手。基于提供的结构化草稿和证据快照整理中文 PRD，只能使用已有事实。只能将决策中采用的想法写入功能范围，暂缓和放弃的方案进入取舍。保留 mindtrace://card/ 标识引用。缺失流程、条件或验收标准写为待确认，不编造已确认要求。输出合法 JSON {"sections":[{"key":"保持原 key","title":"保持原标题","text":"Markdown 正文"}]}，包含原来的每个章节。',
          },
          { role: "user", content: payload },
        ],
      });
      if (modal !== m || m.cancelled || m.requestId !== requestId) return;
      const parsed = JSON.parse(
        raw
          .trim()
          .replace(/^```(?:json)?\s*/, "")
          .replace(/\s*```$/, ""),
      );
      if (!Array.isArray(parsed.sections))
        throw new Error("AI 没有返回有效的文档结构");
      proposal.sections = proposal.sections.map((s) => {
        const next = parsed.sections.find((v) => v.key === s.key);
        if (typeof next?.text !== "string")
          throw new Error("AI 返回的章节不完整，请重试");
        return { ...s, text: "> AI 整理草稿 · 内容需复核\n\n" + next.text };
      });
    } catch (error) {
      if (modal === m && m.requestId === requestId && !m.cancelled) {
        m.error = (error as Error).message;
        m.busy = false;
        renderModal();
      }
      return;
    } finally {
      if (m.requestId === requestId) m.busy = false;
    }
  }
  if (modal !== m || m.cancelled) return;
  openModal("prd-preview", {
    proposal,
    keys: proposal.sections.map((s) => s.key),
    isAI: useAI,
  });
}
function selectCard(id: string, go = false) {
  const target = project().cards.find((c) => c.id === id);
  if (!target) return;
  if (target.deleted) {
    toast("这张卡片已在回收站，可先恢复。");
    return;
  }
  selected = id;
  editing = null;
  detailsOpen = false;
  detailTab = "content";
  if (go) {
    view = "map";
    filter = "all";
    query = "";
    let parent = target.parentId;
    while (parent) {
      const c = project().cards.find((c) => c.id === parent);
      if (!c) break;
      c.collapsed = false;
      parent = c.parentId;
    }
    closeModal();
  }
  render();
  beginEditing(id);
}

async function action(name: string, el?: HTMLElement) {
  const id = el?.dataset.id;
  if (
    id &&
    ["child", "ai", "card-menu", "confirm-card", "show-details"].includes(name)
  ) {
    if (selected !== id) finishEditing();
    selected = id;
  }
  switch (name) {
    case "preview-image":
      openModal("image", { imageId: id, cardId: el?.dataset.cardId });
      break;
    case "insert-image":
      if (id && editing !== id) beginEditing(id, "body");
      rememberRichRange();
      imageTarget = { projectId: project().id, cardId: selected! };
      dom<HTMLInputElement>("#image-file")?.click();
      break;
    case "insert-link": {
      if (id && editing !== id) beginEditing(id, "body");
      rememberRichRange();
      const text = richRange?.toString() || "";
      openModal("link", { label: text, url: linkURL(text) || "" });
      break;
    }
    case "apply-link": {
      const href = linkURL(modal.url || "");
      if (!href) throw new Error("请填写有效的 http 或 https 链接");
      const label = modal.label.trim() || href;
      closeModal();
      insertRich(`<a href="${e(href)}">${e(label)}</a>`);
      break;
    }
    case "copy-image": {
      const asset = project().attachments.find((a) => a.id === modal?.imageId);
      if (asset) {
        await api("copyImage", { data: asset.data, mime: asset.mime });
        toast("图片已复制，可粘贴到其他卡片或应用");
      }
      break;
    }
    case "remove-image": {
      const { imageId, cardId } = modal;
      closeModal();
      beginEditing(cardId, "body");
      const image = [
        ...document.querySelectorAll<HTMLElement>(".rich-body img"),
      ].find((n) => n.dataset.imageId === imageId);
      if (image) {
        const range = document.createRange();
        range.selectNode(image);
        richRange = range;
        restoreRichRange();
        document.execCommand("delete");
        syncRichBody();
      }
      break;
    }
    case "edit-card":
      if (!["map", "cards", "library", "review"].includes(view)) view = "map";
      if (detailsOpen) {
        detailsOpen = false;
        render();
      }
      beginEditing(id || selected!, el?.dataset.editField || "title");
      break;
    case "finish-edit":
      finishEditing();
      break;
    case "show-details":
      editing = null;
      detailsOpen = true;
      detailTab = "content";
      render();
      break;
    case "hide-details":
      detailsOpen = false;
      render();
      break;
    case "new-project":
      openModal("new-project", { title: "", goal: "" });
      break;
    case "edit-project":
      openModal("edit-project", {
        title: project().title,
        goal: project().goal,
      });
      break;
    case "save-project": {
      const title = String(modal.title || "").trim();
      if (!title) throw new Error("请填写项目名称");
      if (modal.kind === "new-project") {
        const p = createProject(title, modal.goal || "");
        state.projects.push(p);
        state.currentProject = p.id;
        selected = null;
        editing = null;
        detailsOpen = false;
        view = "map";
        filter = "all";
        query = "";
        scheduleSave();
      } else
        mutate((p) => {
          p.title = title;
          p.goal = modal.goal || "";
        }, false);
      closeModal();
      render();
      break;
    }
    case "project":
      await flush();
      state.currentProject = id!;
      selected = null;
      editing = null;
      detailsOpen = false;
      filter = "all";
      query = "";
      view = "map";
      docId = "";
      scheduleSave();
      render();
      fit();
      break;
    case "view":
      editing = null;
      detailsOpen = false;
      view = el?.dataset.view || "map";
      filter = "all";
      query = "";
      render();
      if (view === "map") fit();
      break;
    case "trash":
      editing = null;
      detailsOpen = false;
      view = "trash";
      render();
      break;
    case "new-card":
      newCard(selected ? "idea" : "requirement", selected);
      break;
    case "child": {
      const next: Record<CardType, CardType> = {
        requirement: "idea",
        idea: "judgment",
        evidence: "judgment",
        judgment: "decision",
        decision: "validation",
        validation: "idea",
      };
      newCard(card() ? next[card()!.type] : "requirement", selected);
      break;
    }
    case "new-card-type":
      modal.type = el?.dataset.type;
      renderModal();
      break;
    case "create-card": {
      if (!String(modal.title || "").trim()) throw new Error("请填写卡片标题");
      const c = createCard(
        modal.type,
        modal.title.trim(),
        modal.parentId || null,
        { body: modal.body || "" },
      );
      mutate((p) => {
        p.cards.push(c);
        selected = c.id;
        const parent = p.cards.find((n) => n.id === c.parentId);
        if (parent) parent.collapsed = false;
      }, false);
      closeModal();
      view = "map";
      filter = "all";
      query = "";
      render();
      beginEditing(c.id);
      break;
    }
    case "select":
      selectCard(id!);
      break;
    case "go-card":
      selectCard(id!, true);
      break;
    case "detail-tab":
      detailTab = el!.dataset.tab!;
      render();
      break;
    case "collapse":
      mutate((p) => {
        const c = p.cards.find((c) => c.id === id)!;
        c.collapsed = !c.collapsed;
      });
      break;
    case "fit":
      finishEditing();
      fit();
      break;
    case "zoom-in":
    case "zoom-out":
      zoomAt(name === "zoom-in" ? 1.15 : 1 / 1.15);
      break;
    case "close-modal":
      closeModal();
      break;
    case "project-menu":
      openModal("project-menu");
      break;
    case "card-menu":
      if (card()) openModal("card-menu");
      break;
    case "confirm-card":
      if (card()) {
        mutate((p) => {
          const c = card()!;
          if (c.confirmed) c.needsReview = false;
          else confirmCard(p, c.id);
        });
        toast("已确认，理由与依据已保留");
      }
      break;
    case "delete-card":
      if (card()) {
        mutate((p) => removeCard(p, selected!), false);
        selected = null;
        closeModal();
        render();
        toast("已移入回收站");
      }
      break;
    case "restore-card":
      mutate((p) => {
        const c = p.cards.find((c) => c.id === id)!;
        c.deleted = false;
        c.updated = now();
      });
      toast("卡片已恢复");
      break;
    case "detach-card":
      if (card()) {
        mutate((p) => reparent(p, selected!, null));
        closeModal();
        fit();
      }
      break;
    case "duplicate-card":
      if (card()) {
        const original = clone(card()!);
        mutate((p) => {
          const c = createCard(
            original.type,
            original.title + " · 副本",
            null,
            {
              ...original,
              id: uid(),
              title: original.title + " · 副本",
              confirmed: false,
              revision: 0,
              history: [],
              x: undefined,
              y: undefined,
            },
          );
          p.cards.push(c);
          selected = c.id;
        });
        closeModal();
        fit();
      }
      break;
    case "add-link": {
      const target = dom<HTMLSelectElement>("#relation-target")?.value,
        type = dom<HTMLSelectElement>("#relation-type")?.value;
      if (!target) throw new Error("请先创建另一张卡片");
      mutate((p) => addLink(p, selected!, target, type));
      toast("关联已建立");
      break;
    }
    case "unlink":
      mutate((p) => {
        const link = p.links.find((l) => l.id === id);
        if (link) {
          const target = p.cards.find((c) => c.id === link.to);
          if (target) target.needsReview = true;
        }
        p.links = p.links.filter((l) => l.id !== id);
      });
      break;
    case "undo":
      undo();
      break;
    case "redo":
      undo(true);
      break;
    case "search":
      dom<HTMLInputElement>("#search-input")?.focus();
      break;
    case "retry-save":
      await flush();
      toast("已保存到本机");
      break;
    case "settings":
      settings = await api("settings").catch(() => settings);
      openModal("settings", { ...settings, apiKey: "", searchKey: "" });
      break;
    case "preset":
      modal.endpoint = el?.dataset.endpoint;
      modal.model = "";
      renderModal();
      break;
    case "save-settings":
      settings = await api("saveSettings", {
        endpoint: modal.endpoint,
        model: modal.model,
        apiKey: modal.apiKey,
        searchKey: modal.searchKey,
        clear_ai: modal.clear_ai,
        clear_search: modal.clear_search,
      });
      closeModal();
      toast("AI 设置已保存");
      break;
    case "ai":
      openAI();
      break;
    case "run-ai":
      await runAI();
      break;
    case "research":
      openModal("research", {
        query: card()?.questions || card()?.title || "",
        suggestions: [],
        parentId: selected,
      });
      break;
    case "run-research":
      await runAI(true);
      break;
    case "cancel-ai": {
      const m = modal,
        requestId = m.requestId;
      m.cancelled = true;
      await api("cancel", { id: requestId });
      if (modal === m && m.requestId === requestId) {
        m.busy = false;
        m.error = "任务已取消，可以调整后重新生成。";
        renderModal();
      }
      break;
    }
    case "accept-suggestion": {
      const m = modal,
        s: Suggestion = m.suggestions.find((s) => s.id === id);
      if (!s || s.accepted) break;
      mutate((p) => {
        if (s.applyTo) {
          const c = p.cards.find((c) => c.id === s.applyTo && !c.deleted);
          if (!c) throw new Error("原始资料卡已不存在");
          editCard(p, c.id, { body: s.body, origin: "AI 辅助修改" });
        } else {
          acceptSuggestion(p, s, m.parentId || null);
        }
        s.accepted = true;
      }, false);
      render();
      renderModal();
      toast("已采纳到项目");
      break;
    }
    case "import-file":
      openModal("import-options");
      break;
    case "new-note":
      newCard("evidence", selected);
      break;
    case "import-url":
      openModal("url", { url: "", parentId: selected });
      break;
    case "fetch-url": {
      const m = modal;
      if (m.busy) break;
      m.busy = true;
      m.error = "";
      m.requestId = uid();
      renderModal();
      try {
        const result = await api("fetchURL", {
          url: m.url,
          requestId: m.requestId,
        });
        if (modal !== m || m.cancelled) break;
        mutate((p) => {
          const c = createCard(
            "evidence",
            result.title || result.source,
            m.parentId || null,
            {
              source: result.source,
              excerpt: result.text,
              origin: "导入网页",
              sourceKind: "网页正文",
              notes: result.truncated
                ? "正文超过长度限制，已保存前 100,000 字符。"
                : "",
            },
          );
          p.cards.push(c);
          selected = c.id;
        }, false);
        closeModal();
        view = "map";
        editing = null;
        detailsOpen = true;
        render();
        fit();
      } catch (error) {
        m.error = (error as Error).message;
      } finally {
        m.busy = false;
        if (modal === m) renderModal();
      }
      break;
    }
    case "pick-file": {
      const pId = project().id,
        parentId = selected;
      const result = await api("importFile");
      if (!result) break;
      if (project().id !== pId) throw new Error("项目已切换，请重新导入");
      mutate((p) => {
        p.attachments.push({
          id: result.id,
          name: result.name,
          data: result.data,
        });
        const c = createCard("evidence", result.name, parentId, {
          excerpt: result.text,
          source: result.name,
          attachmentId: result.id,
          origin: "导入文件",
          sourceKind: "本地文件",
          notes: result.truncated
            ? "摘录长度已截断；完整原文件保存在附件中。"
            : "",
        });
        p.cards.push(c);
        selected = c.id;
      }, false);
      closeModal();
      view = "map";
      editing = null;
      detailsOpen = true;
      render();
      fit();
      toast("原文件和文字已保存在项目中");
      break;
    }
    case "open-source":
      if (card()) await api("openURL", { url: card()!.source });
      break;
    case "open-attachment": {
      const attachment = project().attachments.find(
        (a) => a.id === card()?.attachmentId,
      );
      if (attachment) await api("openAttachment", { ...attachment });
      else throw new Error("附件不存在");
      break;
    }
    case "export-project":
      await flush();
      if (await api("exportProject", { project: clone(project()) })) {
        closeModal();
        toast("项目备份已导出");
      }
      break;
    case "import-project": {
      const value = await api("importProject");
      if (!value) break;
      const p = validateProject(value);
      if (state.projects.some((n) => n.id === p.id)) {
        p.id = uid();
        p.title += " · 导入副本";
      }
      state.projects.push(p);
      state.currentProject = p.id;
      selected = null;
      docId = "";
      view = "map";
      filter = "all";
      query = "";
      scheduleSave();
      closeModal();
      render();
      fit();
      toast("项目已恢复");
      break;
    }
    case "reveal-data":
      await api("revealData");
      break;
    case "generate-prd":
      openModal("prd-scope", {
        scope: activeCards(project())
          .filter(
            (c) =>
              c.type === "requirement" ||
              (c.type === "decision" && c.confirmed),
          )
          .map((c) => c.id),
      });
      break;
    case "prepare-prd":
      await preparePRD();
      break;
    case "prepare-prd-ai":
      await preparePRD(true);
      break;
    case "save-prd": {
      const m = modal;
      if (!m.keys.length) throw new Error("请至少选择一个章节");
      const previous = documentCurrent();
      mutate((p) => {
        const sections = m.proposal.sections
          .map((s: Section) =>
            m.keys.includes(s.key)
              ? s
              : previous?.sections.find((old) => old.key === s.key),
          )
          .filter(Boolean);
        const sources = [
          ...new Map<string, Source>(
            [...(previous?.sources || []), ...m.proposal.sources].map((s) => [
              s.id + ":" + s.revision,
              s,
            ]),
          ).values(),
        ];
        const doc: PRDocument = {
          id: uid(),
          version: Math.max(0, ...p.documents.map((d) => d.version)) + 1,
          created: now(),
          sections,
          sources,
          needsReview: false,
        };
        p.documents.push(doc);
        docId = doc.id;
      }, false);
      closeModal();
      view = "prd";
      render();
      toast("PRD 草稿已保存，所有依据均可回看");
      break;
    }
    case "snapshot-document": {
      const current = documentCurrent();
      if (current)
        mutate((p) => {
          const next = {
            ...clone(current),
            id: uid(),
            version: Math.max(...p.documents.map((d) => d.version)) + 1,
            created: now(),
          };
          p.documents.push(next);
          docId = next.id;
        });
      break;
    }
    case "source-snapshot": {
      const source = documentCurrent()?.sources.find(
        (s) => s.id === id && s.revision === Number(el?.dataset.revision),
      );
      if (source) openModal("source-snapshot", { source });
      break;
    }
    case "export-prd": {
      const doc = documentCurrent();
      if (doc) {
        await flush();
        if (
          await api("exportMarkdown", {
            name: `${project().title}-PRD-v${doc.version}.md`,
            text: documentMarkdown(project(), doc),
          })
        )
          toast("Markdown 文档已导出");
      }
      break;
    }
    case "recover":
      await api("recover");
      await boot();
      break;
  }
}
function report(error: unknown) {
  const message = (error as Error).message || String(error);
  if (modal) {
    modal.error = message;
    renderModal();
  } else toast(message);
}
document.addEventListener("click", (event) => {
  if (
    Date.now() < suppressClickUntil &&
    (event.target as HTMLElement).closest("#canvas")
  ) {
    event.preventDefault();
    return;
  }
  const clicked = event.target as HTMLElement;
  const link = clicked.closest<HTMLAnchorElement>(
    ".rich-body a, .node-summary a",
  );
  if (link) {
    event.preventDefault();
    event.stopPropagation();
    if (!window.getSelection()?.isCollapsed) return;
    const url = linkURL(link.getAttribute("href") || "");
    if (url) api("openURL", { url }).catch(report);
    return;
  }
  const picture = clicked.closest<HTMLElement>(".rich-body img[data-image-id]");
  if (picture) {
    event.preventDefault();
    openModal("image", { imageId: picture.dataset.imageId, cardId: selected });
    return;
  }
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-action]",
  );
  if (target) {
    event.preventDefault();
    event.stopPropagation();
    action(target.dataset.action!, target).catch(report);
  }
});
document.addEventListener("input", (event) => {
  const input = event.target as HTMLInputElement | HTMLTextAreaElement;
  try {
    if (input.closest("[data-rich-body]")) {
      syncRichBody();
      return;
    }
    if (input.dataset.modalField && modal) {
      modal[input.dataset.modalField] =
        input instanceof HTMLInputElement && input.type === "checkbox"
          ? input.checked
          : input.value;
      return;
    }
    if (input.dataset.field && input.tagName !== "SELECT" && card()) {
      edit(input.dataset.cardId || selected!, {
        [input.dataset.field]: input.value,
      });
      refreshEditedCard();
      return;
    }
    if (input.dataset.suggestion && modal) {
      const s = modal.suggestions.find(
        (s) => s.id === input.dataset.suggestion,
      );
      if (s) s.body = input.value;
      return;
    }
    if (input.dataset.docSection) {
      const d = documentCurrent(),
        s = d?.sections.find((s) => s.key === input.dataset.docSection);
      if (s) {
        const key = d!.id + s.key;
        if (editKey !== key) {
          checkpoint();
          editKey = key;
        }
        s.text = input.value;
        scheduleSave();
      }
      return;
    }
    if (input.id === "search-input") {
      query = input.value;
      const focus = saveFocus();
      const main = dom(".main")!;
      main.innerHTML = mainHead() + toolbar() + mainContent();
      renderGraph();
      restoreFocus(focus);
      if (query) fit();
    }
  } catch (error) {
    report(error);
  }
});
document.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement | HTMLSelectElement;
  try {
    if (input.id === "image-file") {
      const picker = input as HTMLInputElement;
      const files = [...(picker.files || [])];
      picker.value = "";
      addImages(files).catch(report);
      return;
    }
    if (input.dataset.field) {
      if (input.tagName === "SELECT")
        edit(input.dataset.cardId || selected!, {
          [input.dataset.field]: input.value,
        });
      refreshEditedCard();
      return;
    }
    if (input.dataset.choice && card()) {
      const choices = {
        ...card()!.choices,
        [input.dataset.choice]: input.value,
      };
      edit(selected!, { choices });
      refreshEditedCard();
      return;
    }
    if (input.dataset.parent) {
      mutate((p) => reparent(p, selected!, input.value || null));
      fit();
      return;
    }
    if (input.id === "filter-select") {
      filter = input.value;
      render();
      fit();
      return;
    }
    if (input.id === "document-version") {
      docId = input.value;
      render();
      return;
    }
    if (input.dataset.modalField && modal) {
      modal[input.dataset.modalField] =
        input instanceof HTMLInputElement && input.type === "checkbox"
          ? input.checked
          : input.value;
      return;
    }
    for (const [attr, key] of [
      ["context", "context"],
      ["prdScope", "scope"],
      ["prdSection", "keys"],
    ])
      if (input.dataset[attr] && modal) {
        const value = input.dataset[attr]!;
        modal[key] = (input as HTMLInputElement).checked
          ? [...new Set([...modal[key], value])]
          : modal[key].filter((v) => v !== value);
        return;
      }
  } catch (error) {
    report(error);
    render();
  }
});
document.addEventListener("selectionchange", rememberRichRange);
document.addEventListener("paste", (event) => {
  if (modal || !event.clipboardData) return;
  const files = [...event.clipboardData.files].filter((f) =>
    f.type.startsWith("image/"),
  );
  if (files.length && card()) {
    event.preventDefault();
    rememberRichRange();
    addImages(files, { projectId: project().id, cardId: selected! }).catch(
      report,
    );
    return;
  }
  if (!(event.target as HTMLElement).closest("[data-rich-body]")) return;
  event.preventDefault();
  rememberRichRange();
  const text = event.clipboardData.getData("text/plain"),
    html = event.clipboardData.getData("text/html");
  // Plain URLs become links even when another app also supplies a styled HTML span.
  const content = linkURL(text.trim())
    ? linkedText(text)
    : html
      ? cleanRichHTML(html, project().attachments, true)
      : linkedText(text);
  insertRich(content);
});
function zoomAt(factor: number, x?: number, y?: number) {
  const rect = dom("#canvas")?.getBoundingClientRect();
  if (!rect) return;
  x ??= rect.width / 2;
  y ??= rect.height / 2;
  const next = Math.max(0.25, Math.min(2, transform.z * factor)),
    ratio = next / transform.z;
  transform.x = x - (x - transform.x) * ratio;
  transform.y = y - (y - transform.y) * ratio;
  transform.z = next;
  applyTransform();
}
let drag: {
  id?: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
  node?: HTMLElement;
} | null = null;
let suppressClickUntil = 0;
document.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || modal) return;
  const target = event.target as HTMLElement,
    canvas = target.closest("#canvas");
  if (
    !canvas ||
    target.closest("button,input,textarea,select,a,[contenteditable]")
  )
    return;
  const node = target.closest<HTMLElement>("[data-node]");
  if (node) {
    if (!target.closest("[data-drag-handle]")) return;
    event.preventDefault();
    const pos = graphNodes().find((n) => n.id === node.dataset.node)!;
    drag = {
      id: pos.id,
      startX: event.clientX,
      startY: event.clientY,
      x: pos.x,
      y: pos.y,
      moved: false,
      node,
    };
    if (selected !== pos.id) {
      selected = pos.id;
      detailTab = "content";
      document
        .querySelectorAll(".node")
        .forEach((n) =>
          n.classList.toggle(
            "selected",
            (n as HTMLElement).dataset.node === selected,
          ),
        );
      if (dom(".inspector")) dom(".inspector")!.innerHTML = inspector();
    }
  } else
    drag = {
      startX: event.clientX,
      startY: event.clientY,
      x: transform.x,
      y: transform.y,
      moved: false,
    };
});
document.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const dx = event.clientX - drag.startX,
    dy = event.clientY - drag.startY;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  if (!drag.moved) return;
  if (drag.id) {
    drag.node!.style.left = `${drag.x + dx / transform.z}px`;
    drag.node!.style.top = `${drag.y + dy / transform.z}px`;
    const nodes = graphNodes(),
      n = nodes.find((n) => n.id === drag!.id)!;
    n.x = drag.x + dx / transform.z;
    n.y = drag.y + dy / transform.z;
    dom(".edges")!.innerHTML = edgeHTML(nodes);
  } else {
    transform.x = drag.x + dx;
    transform.y = drag.y + dy;
    applyTransform();
  }
});
document.addEventListener("pointerup", (event) => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.moved) suppressClickUntil = Date.now() + 120;
  if (!d.id) {
    if (!d.moved) finishEditing();
    return;
  }
  if (!d.moved) {
    if (editing && editing !== selected) finishEditing();
    return;
  }
  try {
    if (event.altKey) {
      d.node!.style.pointerEvents = "none";
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-node]");
      d.node!.style.pointerEvents = "";
      if (target && target.dataset.node !== d.id) {
        mutate((p) => reparent(p, d.id!, target.dataset.node!));
        fit();
        return;
      }
    }
    mutate((p) => {
      const c = p.cards.find((c) => c.id === d.id)!;
      c.x = d.x + (event.clientX - d.startX) / transform.z;
      c.y = d.y + (event.clientY - d.startY) / transform.z;
    });
  } catch (error) {
    report(error);
    render();
  }
});
document.addEventListener("pointercancel", () => {
  if (drag?.moved) renderGraph();
  drag = null;
});
window.addEventListener("blur", () => {
  if (drag?.moved) renderGraph();
  drag = null;
});
document.addEventListener(
  "wheel",
  (event) => {
    const target = event.target as HTMLElement;
    if (!target.closest("#canvas") || modal) return;
    // Editing has its own native scroll, including textarea selection/scrolling.
    if (target.closest(".editing")) {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
      return;
    }
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const rect = dom("#canvas")!.getBoundingClientRect();
      zoomAt(
        Math.exp(-event.deltaY * 0.008),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    } else {
      transform.x -= event.deltaX;
      transform.y -= event.deltaY;
      applyTransform();
    }
  },
  { passive: false },
);
document.addEventListener("keydown", (event) => {
  if (event.isComposing || event.keyCode === 229) return;
  if (
    !modal &&
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === "k" &&
    (event.target as HTMLElement).closest("[data-rich-body]")
  ) {
    event.preventDefault();
    action("insert-link").catch(report);
    return;
  }
  if (
    !modal &&
    ["Enter", " "].includes(event.key) &&
    (event.target as HTMLElement).matches('.node-summary[role="button"]')
  ) {
    event.preventDefault();
    (event.target as HTMLElement).click();
    return;
  }
  if (event.key === "Escape") {
    if (modal) closeModal();
    else if (editing) finishEditing();
    else if (detailsOpen) {
      detailsOpen = false;
      render();
    }
    return;
  }
  if (
    !modal &&
    editing &&
    (event.metaKey || event.ctrlKey) &&
    event.key === "Enter"
  ) {
    event.preventDefault();
    finishEditing();
    return;
  }
  if (modal) {
    if (event.key === "Tab") {
      const controls = [
        ...document.querySelectorAll<HTMLElement>(
          ".modal button:not(:disabled),.modal input,.modal textarea,.modal select",
        ),
      ];
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    if (
      event.key === "Enter" &&
      (event.target as HTMLElement).tagName !== "TEXTAREA" &&
      ["new-card", "new-project", "edit-project"].includes(modal.kind)
    ) {
      event.preventDefault();
      action(modal.kind === "new-card" ? "create-card" : "save-project").catch(
        report,
      );
    }
    return;
  }
  if ((event.metaKey || event.ctrlKey) && !window.mindtrace) {
    if (event.key.toLowerCase() === "z") {
      if (
        (event.target as HTMLElement).matches(
          "input,textarea,[contenteditable]",
        )
      )
        return;
      event.preventDefault();
      undo(event.shiftKey);
    }
    if (event.key === "0") {
      event.preventDefault();
      fit();
    }
    if (event.key === "f") {
      event.preventDefault();
      dom<HTMLInputElement>("#search-input")?.focus();
    }
  }
});
window.mindtrace?.onCommand((command) => {
  if (
    ["undo", "redo"].includes(command) &&
    document.activeElement?.matches("input,textarea,[contenteditable]")
  ) {
    document.execCommand(command);
    return;
  }
  action(command).catch(report);
});
window.mindtrace?.onFlush(flush);
window.addEventListener("resize", () => {
  if (view === "map") {
    if (editing) {
      render();
      revealEditor();
    } else fit();
  }
});
async function boot() {
  try {
    const loaded = await api("load");
    settings = loaded.settings || settings;
    if (loaded.state) {
      if (
        loaded.state.schema !== 1 ||
        !Array.isArray(loaded.state.projects) ||
        !loaded.state.projects.length
      )
        throw new Error("工作区文件格式无效");
      loaded.state.projects.forEach(validateProject);
      state = loaded.state;
    } else {
      const demo = demoProject();
      state = { schema: 1, projects: [demo], currentProject: demo.id };
      scheduleSave();
    }
    selected =
      activeCards(project()).find((c) => c.type === "idea")?.id || null;
    render();
    requestAnimationFrame(fit);
  } catch (error) {
    dom("#app")!.innerHTML =
      `<div class="error-page"><h2>工作区暂时无法打开</h2><p>原文件仍保留在本机，可从上一份自动备份恢复。</p><pre>${e((error as Error).message)}</pre><div class="row">${btn("recover", "恢复上次保存的备份", "restore", "primary")}${btn("reveal-data", "打开数据目录", "folder", "secondary")}</div></div>`;
  }
}
boot();
