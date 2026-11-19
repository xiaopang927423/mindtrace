import type { Attachment, Card } from "./types.ts";

export const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
export const escapeHTML = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export function linkURL(value: string): string | null {
  const text = value.trim();
  try {
    const url = new URL(/^www\./i.test(text) ? "https://" + text : text);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function linkedText(text: string) {
  const pattern = /(?:https?:\/\/|www\.)[^\s<>"'\u3000]+/gi;
  let result = "",
    last = 0;
  for (const match of text.matchAll(pattern)) {
    const label = match[0].replace(/[。，、；：！？,.!?;:)\]）]+$/u, "");
    const href = linkURL(label);
    if (!href) continue;
    const index = match.index!;
    result +=
      escapeHTML(text.slice(last, index)) +
      `<a href="${escapeHTML(href)}">${escapeHTML(label)}</a>`;
    last = index + label.length;
  }
  return (result + escapeHTML(text.slice(last))).replace(/\n/g, "<br>");
}

// Only this small markup subset enters the editor. Never insert clipboard or
// backup HTML directly; in particular no remote image or event handler survives.
export function cleanRichHTML(
  html: string,
  attachments: Attachment[],
  display = false,
  preview = false,
) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const assets = new Map(attachments.map((a) => [a.id, a]));
  const walk = (node: Node): string => {
    if (node.nodeType === 3) return escapeHTML(node.textContent || "");
    if (node.nodeType !== 1) return "";
    const el = node as Element,
      tag = el.tagName.toLowerCase();
    if (
      [
        "script",
        "style",
        "iframe",
        "object",
        "svg",
        "math",
        "template",
      ].includes(tag)
    )
      return "";
    if (tag === "br") return "<br>";
    if (tag === "img") {
      const id = el.getAttribute("data-image-id"),
        asset = id ? assets.get(id) : null;
      if (!asset?.mime || !IMAGE_TYPES.includes(asset.mime)) return "";
      if (preview)
        return `<span class="image-indicator">［图片：${escapeHTML(asset.name)}］</span>`;
      return `<img data-image-id="${escapeHTML(asset.id)}" alt="${escapeHTML(asset.name)}"${display ? ` src="data:${asset.mime};base64,${escapeHTML(asset.data)}" draggable="false" contenteditable="false" title="点击查看图片"` : ""}>`;
    }
    const children = [...el.childNodes].map(walk).join("");
    if (tag === "a") {
      const href = linkURL(el.getAttribute("href") || "");
      return href
        ? `<a href="${escapeHTML(href)}"${display ? ' title="点击在浏览器打开"' : ""}>${children}</a>`
        : children;
    }
    if (["p", "div", "strong", "b", "em", "i", "u"].includes(tag))
      return `<${tag}>${children}</${tag}>`;
    return children;
  };
  return [...parsed.body.childNodes].map(walk).join("");
}

export function richBody(c: Card, attachments: Attachment[], preview = false) {
  return cleanRichHTML(
    c.bodyHtml ?? linkedText(c.body),
    attachments,
    true,
    preview,
  );
}

export function richText(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const walk = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent || "";
    if (node.nodeType !== 1) return "";
    const el = node as Element,
      tag = el.tagName.toLowerCase();
    if (tag === "br") return "\n";
    if (tag === "img") return `[图片：${el.getAttribute("alt") || "图片"}]`;
    const text = [...el.childNodes].map(walk).join("");
    if (tag === "a") {
      const url = el.getAttribute("href") || "";
      return text === url ? text : `${text} (${url})`;
    }
    return ["p", "div"].includes(tag) ? text + "\n" : text;
  };
  return [...parsed.body.childNodes].map(walk).join("").replace(/\n$/, "");
}

export async function imageAttachment(file: File): Promise<Attachment> {
  if (!IMAGE_TYPES.includes(file.type))
    throw new Error("支持 PNG、JPEG、WebP 和 GIF 图片");
  if (file.size > 10 * 1024 * 1024) throw new Error("单张图片不能超过 10 MB");
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new Error("图片文件无法读取，请选择有效图片");
  }
  if (image.naturalWidth * image.naturalHeight > 40_000_000)
    throw new Error("图片分辨率过大，请先缩小到 4000 万像素以内");
  return {
    id: crypto.randomUUID(),
    name: file.name || "粘贴的图片.png",
    mime: file.type,
    data: url.slice(url.indexOf(",") + 1),
  };
}
