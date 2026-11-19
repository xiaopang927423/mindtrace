# 思序 · MindTrace

一个面向个人的 Mac 思考与决策工作台。用脑图连接需求、想法、资料、判断、决策和验证，保留各自的理由与出处，再生成可编辑、可追溯的 PRD。

使用 **TypeScript + Electron** 开发。第一版面向 Apple Silicon Mac，安装包为 DMG，不需要用户拥有苹果开发者账号。

## 安装

1. 从 [GitHub Release](https://github.com/xiaopang927423/mindtrace/releases/tag/v0.2.0) 下载并打开 `MindTrace-0.2.0-mac-arm64.dmg`。
2. 将「思序」拖到「Applications / 应用程序」。
3. 从「应用程序」打开思序。

本版使用 ad-hoc 本地签名，未做 Apple 公证。如果通过浏览器下载或其他方式传输后，macOS 提示无法验证开发者，可在尝试打开后进入「系统设置 → 隐私与安全性 → 仍要打开」，仅允许本应用。无需关闭系统安全保护。参见 [Apple 的官方打开说明](https://support.apple.com/en-us/102445)。

当前包为 **arm64**，适用于 M 系列 Mac。已在当前 macOS 26.4 / Apple Silicon 环境验证；最低版本声明为 macOS 13，尚未在旧版系统和 Intel Mac 上实测。

## 已实现

- 项目创建、编辑、搜索，本地自动保存，保存失败提示及重试。
- 需求、想法、资料、判断、决策、验证六类卡片。
- 卡片正文支持图文混排、图片复制粘贴、从文件插入图片、缩略图与大图预览。
- 粘贴网址自动转为链接，选中文字可添加超链接；点击由默认浏览器访问。
- 脑图平移、缩放、适应画布、分支折叠、节点拖动、层级调整和有类型的关联。
- 判断理由与决策理由独立保存，确认前校验必填信息。
- 决策方案分别选择采用、暂缓、放弃；采用结果与验证结果独立。
- 已确认卡片的修订历史、关联内容待复核提示。
- 撤销与重做、回收站与恢复；删除保留引用。
- 可提取文字的 PDF、TXT、Markdown 和公开网页导入；原始附件进入项目备份。
- AI 需求拆解、想法发散、资料摘要、判断与决策建议；结果可编辑、逐条采纳。
- Tavily 联网检索真实来源，保留检索摘要与原始链接。
- 根据选择的需求和已确认决策生成结构化 PRD，或由 AI 辅助整理。
- PRD 章节选择、更新前对比、手动编辑、历史版本与来源快照。
- Markdown 导出，以及包含卡片、关系、文档和附件的 `.mindtrace` 项目备份与恢复。

首次打开包含一个可编辑的演示项目。新建自己的项目即可开始。

v0.2 改为卡片原位编辑：脑图与卡片视图均可直接修改标题和正文，判断结论、判断理由、成立条件、决策理由、适用范围和方案选择也在卡片内填写。详情面板默认收起，保留长资料、补充字段、关联和历史。沿用原工作区数据格式，升级保留已有项目。

## AI 设置

在左下角「AI 设置」填写：

- **完整接口地址**：提供 Chat Completions 格式的服务地址，以 `/chat/completions` 结尾。
- **模型名称**：使用服务商提供或本机已安装的准确名称。
- **API Key**：填写该服务密钥；不需要认证的本地服务可以留空。
- **Tavily Key**：仅联网寻找资料时需要；与模型密钥独立。

界面提供 DeepSeek 和本地 Ollama 地址快捷填入。模型名称由用户填写，不锁定特定厂商。更换接口地址会清除旧服务的模型密钥，避免发送到新的地址。

模型请求和资料检索都由用户主动触发。AI 面板显示本次发送的卡片范围。密钥通过 Electron `safeStorage` 使用 macOS 的加密能力保存，项目备份不包含密钥。

官方接口参考：[DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)、[Ollama 兼容接口](https://docs.ollama.com/api/openai-compatibility)、[Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search)。

## 操作提示

- 单击卡片标题或正文：在原位展开编辑，不需要双击。
- 正文里 `⌘V` 粘贴图片，或点击「图片」选择文件；支持 PNG、JPEG、WebP、GIF，单张不超过 10 MB、4000 万像素。
- 点击图片查看大图；「复制图片」可继续粘贴到其他卡片或应用，「从正文移除」可撤销。原始图片随项目保存与备份，历史引用仍保留。
- 粘贴 `https://…` 或 `www.…` 自动生成链接；选中文字后点击「链接」或按 `⌘K`，填写链接地址。点击链接使用默认浏览器打开。
- 内容自动保存；点击「完成」、空白画布、按 `Esc` 或 `⌘Enter` 收起编辑。收起不会丢弃修改。
- 只拖动卡片顶部移动位置；正文支持正常选择、复制和换行。
- 编辑区内滚动只滚动文字或表单，不移动画布。
- 点击卡片「详情」查看补充字段、长资料、关联与历史；关闭按钮收起详情。
- 拖动空白处或触控板滚动：移动画布。
- 双指缩放或画布右下角按钮：缩放。
- `⌘0`：适应画布。
- 按住 `⌥` 将卡片顶部拖到另一张卡片：调整层级；也可在详情底部选择所在分支。
- 「关联」页签：建立支持、反驳、依据、评估等关系。
- `⌘Z` / `⇧⌘Z`：输入框内撤销、重做文字；其他位置撤销、重做项目操作。
- `⌘F`：搜索卡片。
- `⌘N`：新建项目。
- 「项目操作 → 导出项目备份」：备份完整项目。

## 数据与恢复

正式应用数据默认保存到 `~/Library/Application Support/MindTrace/`：

- `workspace.json`：完整工作区。
- `workspace.previous.json`：上一份成功保存前的备份。
- `settings.json`：不含密钥的模型配置。
- `credentials.enc`：经过本机加密的密钥。

保存通过临时文件与原子重命名完成，连续保存按顺序执行。退出前等待当前内容保存。工作区文件损坏时，应用提供从上一份备份恢复的入口，并保留恢复前的文件。

网页预览使用独立的浏览器本地数据，不与正式应用同步。文件导入与 AI 调用在桌面应用内使用。

## 开发与构建

需要 Node.js 24、npm，以及 macOS 上的打包环境。源码位于 `Web/*.ts` 与 `electron/*.ts`。

```sh
npm ci
npm run typecheck
npm test
npm start
```

构建 DMG：

```sh
npm run package
```

该命令构建 TypeScript，使用 electron-builder 制作 Apple Silicon DMG，并使用无需账号的 ad-hoc 签名。安装包不上传 App Store、不提交公证，也不执行自动发布。

也可在 GitHub 的「Actions → Build macOS DMG → Run workflow」填写已推送的版本标签，例如 `v0.2.0`。流程在 macOS 15 / Apple Silicon 上检查类型、运行测试、构建 DMG，再从 DMG 安装应用并运行桌面测试。通过后，将安装包及 `SHA256SUMS.txt` 上传到对应的 Release 草稿；检查发布说明后手动发布。流程不会覆盖已经公开发布的版本。

```sh
npm run test:ui
```

桌面测试使用临时工作区和本地 HTTP 测试服务，覆盖原位编辑、文本撤销与重做、文字选择不拖动卡片、输入法按键保护、编辑区滚动、顶部拖动、卡片视图编辑、确认规则、PRD 生成和手动编辑、PDF 导入、备份导出、AI 部分采纳与取消、重启保留以及导入恢复；不使用真实模型密钥，不污染正式项目。

界面调试：先 `npm run build`，再 `npm run dev`。浏览器预览地址为 `http://127.0.0.1:4173`。

## 当前边界

- 未使用真实付费模型密钥或 Tavily 密钥完成线上端到端测试；已验证本地测试接口与错误处理。
- AI 建议可能出错，始终作为草稿；判断和决策由用户确认。
- 图片目前用于保存、预览与复制，尚不发送给 AI 做视觉识别或 OCR；PRD 目前仍以文字和来源为主。
- 支持文字 PDF，不支持扫描件 OCR；每个导入文件最大 20 MB。长文件摘录会明确标注截断，完整附件仍保留。
- 网页读取支持公开静态正文；不登录网站、不绕过访问限制。跳转或动态页面可改用粘贴原文。
- 第一版只提示直接关联的影响，不自动推理整张图的所有隐含依赖。
- 尚无云同步、多人协作、Windows 安装包、Word/PDF 文档导出。
- 原子 JSON 文件适合当前个人项目规模，尚未承诺超大脑图性能。

桌面隔离依据：[Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)、[Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)。渲染层不启用 Node，预加载仅暴露限定动作，主进程验证消息来源，外部地址不在应用特权页面内导航。

图片复制使用 [Electron Clipboard API](https://www.electronjs.org/docs/latest/api/clipboard)，仅在主动点击「复制图片」时写入剪贴板。粘贴的图文只保留支持的内容格式，图片作为本地附件保存。
