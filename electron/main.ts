import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  dialog,
  shell,
  safeStorage,
  session,
  clipboard,
  ClipboardItem,
  nativeImage,
} from "electron";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseHTML } from "linkedom";
import {
  WorkspaceStore,
  atomicWrite,
  safeURL,
  boundedFetch,
  parseAIResponse,
} from "./services.ts";
import { validateProject } from "../Web/core.ts";
import type { Settings, Workspace } from "../Web/types.ts";

app.setName("MindTrace");
if (process.env.MINDTRACE_DATA_DIR)
  app.setPath("userData", process.env.MINDTRACE_DATA_DIR);
const root = app.getPath("userData");
const store = new WorkspaceStore(root);
let win: BrowserWindow;
let closing = false,
  flushID = "";
const jobs = new Map<string, AbortController>();
const indexPath = path.resolve(__dirname, "../Web/index.html");
const allowedURL = pathToFileURL(indexPath).href;
const settingsFile = path.join(root, "settings.json");
const credentialsFile = path.join(root, "credentials.enc");
type Credentials = { ai?: string; search?: string };

async function settings(): Promise<Settings> {
  try {
    return JSON.parse(await readFile(settingsFile, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      return { endpoint: "", model: "" };
    throw e;
  }
}
async function credentials(): Promise<Credentials> {
  try {
    const data = await readFile(credentialsFile);
    if (!safeStorage.isEncryptionAvailable())
      throw new Error("macOS 加密存储不可用");
    return JSON.parse(safeStorage.decryptString(data));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
}
async function publicSettings() {
  const s = await settings(),
    c = await credentials();
  return { ...s, hasKey: !!c.ai, hasSearchKey: !!c.search };
}
async function withJob<T>(
  id: string,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  jobs.set(id, controller);
  const timeout = setTimeout(
    () => controller.abort(new Error("请求超时，请重试")),
    120000,
  );
  try {
    return await work(controller.signal);
  } catch (e) {
    if (controller.signal.aborted) throw new Error("任务已取消或请求超时");
    throw e;
  } finally {
    clearTimeout(timeout);
    jobs.delete(id);
  }
}
async function boundedFile(file: string, limit: number) {
  if ((await stat(file)).size > limit)
    throw new Error(`文件超过 ${Math.round(limit / 1024 / 1024)} MB 限制`);
  return readFile(file);
}
async function handle(action: string, p: any): Promise<any> {
  switch (action) {
    case "load":
      return {
        state: await store.load(),
        settings: await publicSettings(),
        dataPath: root,
      };
    case "save":
      await store.save(p.state as Workspace);
      return true;
    case "recover":
      return store.recover();
    case "revealData":
      await mkdir(root, { recursive: true });
      await shell.openPath(root);
      return true;
    case "settings":
      return publicSettings();
    case "saveSettings": {
      const endpoint = String(p.endpoint || "").trim(),
        model = String(p.model || "").trim();
      if (endpoint) safeURL(endpoint, true);
      const old = await settings(),
        c = await credentials();
      if (old.endpoint !== endpoint) c.ai = "";
      if (p.apiKey) c.ai = String(p.apiKey).trim();
      if (p.searchKey) c.search = String(p.searchKey).trim();
      if (p.clear_ai) c.ai = "";
      if (p.clear_search) c.search = "";
      if ((c.ai || c.search) && !safeStorage.isEncryptionAvailable())
        throw new Error("无法使用 macOS 加密存储，密钥未保存");
      if (c.ai || c.search || p.clear_ai || p.clear_search)
        await atomicWrite(
          credentialsFile,
          safeStorage.encryptString(JSON.stringify(c)),
        );
      await atomicWrite(settingsFile, JSON.stringify({ endpoint, model }));
      return publicSettings();
    }
    case "cancel":
      jobs.get(String(p.id))?.abort();
      return true;
    case "ai":
      return withJob(String(p.requestId), async (signal) => {
        const s = await settings();
        if (!s.endpoint || !s.model)
          throw new Error("请先在 AI 设置中填写完整接口地址与模型");
        if (!Array.isArray(p.messages) || !p.messages.length)
          throw new Error("缺少 AI 输入");
        const c = await credentials(),
          headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
        if (c.ai) headers.Authorization = `Bearer ${c.ai}`;
        const data = await boundedFetch(safeURL(s.endpoint, true), {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: s.model,
            messages: p.messages,
            stream: false,
          }),
          signal,
        });
        return parseAIResponse(JSON.parse(data.text));
      });
    case "search":
      return withJob(String(p.requestId), async (signal) => {
        const c = await credentials();
        if (!c.search) throw new Error("请先在 AI 设置中配置 Tavily 检索密钥");
        const query = String(p.query || "").trim();
        if (!query) throw new Error("请输入研究问题");
        const { text } = await boundedFetch(
          new URL("https://api.tavily.com/search"),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${c.search}`,
            },
            body: JSON.stringify({
              query,
              max_results: 5,
              search_depth: "basic",
              include_raw_content: false,
            }),
            signal,
          },
        );
        const data = JSON.parse(text);
        if (!Array.isArray(data.results))
          throw new Error("检索服务返回了无效结果");
        return data.results
          .filter(
            (r) =>
              typeof r.url === "string" &&
              /^https?:\/\//.test(r.url) &&
              typeof r.content === "string",
          )
          .map((r) => ({
            title: String(r.title || r.url),
            url: r.url,
            content: r.content,
          }));
      });
    case "fetchURL":
      return withJob(String(p.requestId), async (signal) => {
        const url = safeURL(String(p.url || ""));
        const { text: html, type } = await boundedFetch(
          url,
          { signal },
          5 * 1024 * 1024,
        );
        if (type && !/text|json|xml/.test(type))
          throw new Error("该地址不是网页文本，请下载文件后导入");
        if (/text\/plain|application\/json/.test(type)) {
          const text = html.trim();
          if (text.length < 30)
            throw new Error("地址返回的文字过短，请检查来源");
          return {
            source: url.href,
            title: url.hostname,
            text: text.slice(0, 100000),
            truncated: text.length > 100000,
          };
        }
        const { document } = parseHTML(html);
        document
          .querySelectorAll("script,style,noscript,nav,footer,header")
          .forEach((n) => n.remove());
        const source =
          document.querySelector("article") ||
          document.querySelector("main") ||
          document.body;
        const text = (
          source?.textContent ||
          document.documentElement.textContent ||
          ""
        )
          .replace(/[ \t]{2,}/g, " ")
          .trim();
        if (text.length < 30)
          throw new Error(
            "未取得足够正文，页面可能需要登录或动态加载。可改为粘贴原文。",
          );
        return {
          source: url.href,
          title: document.querySelector("title")?.textContent || url.hostname,
          text: text.slice(0, 100000),
          truncated: text.length > 100000,
        };
      });
    case "importFile": {
      const result = await dialog.showOpenDialog(win, {
        properties: ["openFile"],
        filters: [{ name: "研究资料", extensions: ["pdf", "txt", "md"] }],
      });
      if (result.canceled) return null;
      const file = result.filePaths[0],
        data = await boundedFile(file, 20 * 1024 * 1024);
      let text = "";
      if (file.toLowerCase().endsWith(".pdf")) {
        const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const pdf = await getDocument({
          data: new Uint8Array(data),
          useSystemFonts: true,
          isEvalSupported: false,
        }).promise;
        try {
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i),
              content = await page.getTextContent();
            text +=
              `\n\n第 ${i} 页\n` +
              content.items
                .map((item) => ("str" in item ? item.str : ""))
                .join(" ");
          }
        } finally {
          await pdf.destroy();
        }
      } else {
        text = data.toString("utf8");
      }
      if (!text.replace(/第 \d+ 页/g, "").trim())
        throw new Error("文件没有可提取的文字。扫描 PDF 暂不支持 OCR。");
      return {
        id: crypto.randomUUID(),
        name: path.basename(file),
        data: data.toString("base64"),
        text: text.slice(0, 120000),
        truncated: text.length > 120000,
      };
    }
    case "exportProject": {
      const project = validateProject(p.project);
      const result = await dialog.showSaveDialog(win, {
        defaultPath: `${project.title.replace(/[/:]/g, "-")}.mindtrace`,
        filters: [{ name: "思序项目", extensions: ["mindtrace"] }],
      });
      if (result.canceled || !result.filePath) return false;
      await writeFile(
        result.filePath,
        JSON.stringify(
          { format: "mindtrace-project", version: 1, project },
          null,
          2,
        ),
      );
      return true;
    }
    case "importProject": {
      const result = await dialog.showOpenDialog(win, {
        properties: ["openFile"],
        filters: [{ name: "思序项目", extensions: ["mindtrace", "json"] }],
      });
      if (result.canceled) return null;
      const value = JSON.parse(
        (await boundedFile(result.filePaths[0], 200 * 1024 * 1024)).toString(
          "utf8",
        ),
      );
      if (value.format !== "mindtrace-project" || value.version !== 1)
        throw new Error("不是兼容的思序项目");
      return validateProject(value.project);
    }
    case "exportMarkdown": {
      const result = await dialog.showSaveDialog(win, {
        defaultPath: String(p.name || "PRD.md").replace(/[/:]/g, "-"),
        filters: [{ name: "Markdown 文档", extensions: ["md"] }],
      });
      if (result.canceled || !result.filePath) return false;
      await writeFile(result.filePath, String(p.text || ""), "utf8");
      return true;
    }
    case "openURL":
      await shell.openExternal(safeURL(String(p.url || "")).href);
      return true;
    case "copyImage": {
      if (
        !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
          p.mime,
        ) ||
        typeof p.data !== "string" ||
        p.data.length > 14 * 1024 * 1024
      )
        throw new Error("图片格式或大小无效");
      const image = nativeImage.createFromDataURL(
        `data:${p.mime};base64,${p.data}`,
      );
      if (image.isEmpty())
        throw new Error("该图片无法复制，请尝试 PNG 或 JPEG 格式");
      await clipboard.write([
        new ClipboardItem({
          "image/png": new Blob([new Uint8Array(image.toPNG())], {
            type: "image/png",
          }),
        }),
      ]);
      return true;
    }
    case "openAttachment": {
      const name = path.basename(String(p.name || "附件"));
      if (!/\.(pdf|txt|md)$/i.test(name))
        throw new Error("只可打开 PDF 或文本附件");
      const folder = path.join(root, "AttachmentPreview");
      await mkdir(folder, { recursive: true });
      const file = path.join(folder, name);
      await writeFile(file, Buffer.from(String(p.data || ""), "base64"));
      const result = await shell.openPath(file);
      if (result) throw new Error(result);
      return true;
    }
    default:
      throw new Error("不支持的操作");
  }
}
const actions = [
  "load",
  "save",
  "recover",
  "settings",
  "saveSettings",
  "ai",
  "search",
  "cancel",
  "fetchURL",
  "importFile",
  "exportProject",
  "importProject",
  "exportMarkdown",
  "openURL",
  "copyImage",
  "openAttachment",
  "revealData",
];
for (const action of actions)
  ipcMain.handle(`mindtrace:${action}`, async (event, p) => {
    if (
      event.sender !== win?.webContents ||
      event.senderFrame?.url !== allowedURL
    )
      return { error: "无效的操作来源" };
    try {
      return { value: await handle(action, p || {}) };
    } catch (error) {
      return { error: (error as Error).message };
    }
  });
ipcMain.on("mindtrace:flushed", (event, result) => {
  if (event.sender !== win?.webContents || result.id !== flushID) return;
  flushID = "";
  if (result.ok) {
    closing = true;
    win.close();
  } else
    dialog.showMessageBox(win, {
      type: "error",
      message: "尚有内容未保存",
      detail: "请检查保存状态或导出项目后再退出。",
    });
});
function send(command: string) {
  win?.webContents.send("mindtrace:command", command);
}
function createWindow() {
  win = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    title: "思序 · MindTrace",
    backgroundColor: "#faf9f6",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== allowedURL) event.preventDefault();
  });
  win.on("close", (event) => {
    if (!closing) {
      event.preventDefault();
      if (!flushID) {
        flushID = crypto.randomUUID();
        win.webContents.send("mindtrace:flush", flushID);
      }
    }
  });
  win.once("ready-to-show", () => win.show());
  win.loadFile(indexPath);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "思序",
        submenu: [
          { role: "about", label: "关于思序" },
          { type: "separator" },
          {
            label: "AI 设置…",
            accelerator: "CmdOrCtrl+,",
            click: () => send("settings"),
          },
          { type: "separator" },
          { role: "hide", label: "隐藏思序" },
          { role: "quit", label: "退出思序" },
        ],
      },
      {
        label: "文件",
        submenu: [
          {
            label: "新建项目",
            accelerator: "CmdOrCtrl+N",
            click: () => send("new-project"),
          },
          {
            label: "备份项目…",
            accelerator: "CmdOrCtrl+Shift+S",
            click: () => send("export-project"),
          },
          { label: "导入项目…", click: () => send("import-project") },
          { type: "separator" },
          { role: "close", label: "关闭窗口" },
        ],
      },
      {
        label: "编辑",
        submenu: [
          {
            label: "撤销",
            accelerator: "CmdOrCtrl+Z",
            click: () => send("undo"),
          },
          {
            label: "重做",
            accelerator: "CmdOrCtrl+Shift+Z",
            click: () => send("redo"),
          },
          { type: "separator" },
          { role: "cut", label: "剪切" },
          { role: "copy", label: "复制" },
          { role: "paste", label: "粘贴" },
          { role: "selectAll", label: "全选" },
          {
            label: "搜索",
            accelerator: "CmdOrCtrl+F",
            click: () => send("search"),
          },
        ],
      },
      {
        label: "视图",
        submenu: [
          {
            label: "适应画布",
            accelerator: "CmdOrCtrl+0",
            click: () => send("fit"),
          },
          { role: "togglefullscreen", label: "全屏" },
        ],
      },
      { role: "windowMenu", label: "窗口" },
    ]),
  );
}
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_web, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  createWindow();
});
app.on("before-quit", (event) => {
  if (!closing && win && !win.isDestroyed()) {
    event.preventDefault();
    win.close();
  }
});
app.on("window-all-closed", () => app.quit());
