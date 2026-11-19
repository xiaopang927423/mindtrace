# v0.2 验证记录

日期：2026-11-19（Asia/Shanghai）

## 环境

- macOS 26.4，Apple Silicon arm64。
- TypeScript 5.9.3、Electron 45.3.4、electron-builder 26.18.0。
- 桌面 UI 验证通过 Playwright 驱动真实 Electron 应用。

## 已通过

- `npm run typecheck`。
- `npm test`：27 项测试，全部通过。
- `npm run test:ui`：开发应用的完整桌面流程通过。
- 从 DMG 挂载卷复制出的应用执行同一套桌面流程，全部通过。
- `codesign --verify --deep --strict`：本地 ad-hoc 签名有效。
- `hdiutil verify`：DMG 校验和有效。

桌面流程包含：

- 单击卡片标题或正文原位编辑，默认没有侧栏；脑图与卡片视图均可编辑。
- 文本撤销与重做，文字选择不拖动节点，输入法组合按键保护，滚动编辑区不平移画布，顶部拖动。
- 卡片变大时自动布局为分支预留空间；已手动移动的节点保留位置。
- 剪贴板图片粘贴事件、文件选择插图、缩略图、大图预览、复制图片的主进程调用、移除图片与撤销。
- 粘贴网址生成链接、选中文字后 `⌘K` 添加超链接、点击编辑区与折叠卡片中的链接交给浏览器。
- 拒绝脚本链接；粘贴 HTML 清理事件处理器、脚本与外部图片，保留受支持内容。
- 图片与超链接在自动保存、重启和项目备份导入后保留；图片数据独立于正文，历史保留引用。
- 新建项目、需求/想法/判断/决策实际编辑、条件与理由校验、PRD 生成、手动编辑与版本保存、项目导出、PDF 文字提取及附件保存、AI 建议编辑与部分采纳、取消任务、备份导入且不覆盖原项目。

## 验证边界

- AI 调用使用本地 HTTP 测试服务验证请求、响应、采纳和取消；没有使用用户真实模型或 Tavily 密钥。
- 图片粘贴通过标准剪贴板事件注入验证；复制图片和浏览器打开验证至主进程的系统 API 调用，测试拦截实际剪贴板写入与浏览器启动，避免覆盖用户剪贴板或打开额外网页。未穷举其他应用的剪贴板格式。
- 中文输入法保护通过组合按键事件验证，未覆盖所有第三方输入法。
- 已在本地 macOS 26.4 和 GitHub Actions 的 macOS 15 / Apple Silicon 环境验证；未测试 Intel Mac 和 macOS 13、14。
- DMG 可挂载、复制和启动；未执行 Apple 公证，也未模拟从互联网下载后触发的 Gatekeeper 隔离提示。

截图：`test-results/desktop-initial.png`、`test-results/inline-editing.png`、`test-results/inline-decision.png`、`test-results/rich-card.png`、`test-results/prd-document.png`。

交付：`dist/v0.2.0/MindTrace-0.2.0-mac-arm64.dmg`。SHA-256 见 `dist/v0.2.0/SHA256SUMS.txt`。升级沿用原工作区格式与数据目录；打包保留 v0.1.0 安装包和原应用输出，未修改用户正在使用的应用。

## GitHub 发布构建

[构建记录](https://github.com/xiaopang927423/mindtrace/actions/runs/44447253331)：从 `v0.2.0` 标签在 macOS 15 / arm64 重新构建。类型检查、27 项测试、DMG 校验、复制安装后的签名检查及完整桌面流程全部通过。

[GitHub Release](https://github.com/xiaopang927423/mindtrace/releases/tag/v0.2.0) 提供云端构建的 DMG 和对应的 `SHA256SUMS.txt`，其 SHA-256 为 `e2834e2d84fab18ac2ba115ec0968d8f1ed8ddb8f2a797242b713abd405c4249`。该值与 GitHub 返回的安装包摘要一致；本地构建与云端构建的安装包校验值不同，应使用随各自安装包提供的校验文件。
