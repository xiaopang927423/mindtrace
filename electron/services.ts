import { mkdir, readFile, writeFile, rename, copyFile } from "node:fs/promises";
import path from "node:path";
import { validateProject } from "../Web/core.ts";
import type { Workspace } from "../Web/types.ts";

export function validateWorkspace(value: any): Workspace {
  if (
    value?.schema !== 1 ||
    !Array.isArray(value.projects) ||
    !value.projects.length ||
    typeof value.currentProject !== "string"
  )
    throw new Error("工作区格式无效，原文件已保留");
  const ids = new Set<string>();
  for (const p of value.projects) {
    validateProject(p);
    if (ids.has(p.id)) throw new Error("项目标识重复");
    ids.add(p.id);
  }
  if (!ids.has(value.currentProject)) throw new Error("当前项目不存在");
  return value;
}
export class WorkspaceStore {
  private tail: Promise<void> = Promise.resolve();
  readonly root: string;
  constructor(root: string) {
    this.root = root;
  }
  async load(): Promise<Workspace | null> {
    try {
      return validateWorkspace(
        JSON.parse(
          await readFile(path.join(this.root, "workspace.json"), "utf8"),
        ),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  save(value: Workspace): Promise<void> {
    validateWorkspace(value);
    const data = JSON.stringify(value);
    const task = this.tail
      .catch(() => {})
      .then(async () => {
        await mkdir(this.root, { recursive: true });
        const file = path.join(this.root, "workspace.json");
        try {
          await copyFile(file, path.join(this.root, "workspace.previous.json"));
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
        await atomicWrite(file, data);
      });
    this.tail = task;
    return task;
  }
  async recover(): Promise<Workspace> {
    const value = validateWorkspace(
      JSON.parse(
        await readFile(path.join(this.root, "workspace.previous.json"), "utf8"),
      ),
    );
    const current = path.join(this.root, "workspace.json");
    try {
      await copyFile(
        current,
        path.join(this.root, `workspace.recovery-${Date.now()}.json`),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    await atomicWrite(current, JSON.stringify(value));
    return value;
  }
}
export async function atomicWrite(file: string, data: string | Buffer) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  await writeFile(temp, data, { mode: 0o600 });
  await rename(temp, file);
}
export function safeURL(value: string, localOnlyHTTP = false): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("请输入完整的有效地址");
  }
  if (
    url.username ||
    url.password ||
    !["https:", "http:"].includes(url.protocol) ||
    !url.hostname
  )
    throw new Error("只支持 HTTP / HTTPS 地址");
  if (
    localOnlyHTTP &&
    url.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error("远程 AI 服务请使用 HTTPS；本地服务可使用 HTTP");
  return url;
}
export async function boundedFetch(
  url: URL,
  init: RequestInit = {},
  limit = 24 * 1024 * 1024,
): Promise<{ text: string; type: string }> {
  const response = await fetch(url, { ...init, redirect: "error" });
  if (!response.ok)
    throw new Error(
      `服务返回 HTTP ${response.status}。请检查服务地址、模型、密钥或额度。`,
    );
  if (Number(response.headers.get("content-length") || 0) > limit)
    throw new Error("内容过大，请使用较小资料或粘贴摘录");
  if (!response.body) throw new Error("服务返回空内容");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new Error("内容超出大小限制");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return {
    text: Buffer.concat(chunks).toString("utf8"),
    type: response.headers.get("content-type") || "",
  };
}
export function parseAIResponse(data: any): string {
  if (data.choices?.[0]?.finish_reason === "length")
    throw new Error("AI 输出达到长度限制，请缩小上下文后重试");
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim())
    throw new Error("服务没有返回有效文本，请检查模型和接口兼容性");
  return content;
}
