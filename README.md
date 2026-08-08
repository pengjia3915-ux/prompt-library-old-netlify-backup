# Prompt 库 PWA

一个仅供个人使用的轻量 Prompt 管理与组合工具。核心功能使用原生 HTML、CSS、JavaScript、IndexedDB 和 PWA，默认不需要账号，也不调用 AI API。知识库的跨设备同步是可选功能，使用当前站点配置的免费同步接口；不启用同步码时，所有数据仍只保存在本机。

## 先运行起来

不要直接双击 `index.html`。由于配置文件和 Service Worker 需要 HTTP 环境，请在 `prompt-library-pwa` 文件夹中启动一个本地静态服务。

如果电脑安装了 Python：

```bash
python -m http.server 8080
```

然后打开：<http://localhost:8080>

也可以使用任意静态文件服务器，例如 Node.js 的 `npx serve .`。本项目没有构建步骤，也没有需要安装的前端框架。

### 同一 Wi-Fi 下临时用手机打开

如果电脑和 Android 手机连接的是同一个 Wi-Fi，可以临时让手机访问电脑上的开发服务：

```bash
python -m http.server 8080 --bind 0.0.0.0
```

在电脑执行 `ipconfig`，找到当前网卡的 IPv4 地址，然后在手机 Chrome 打开：

```text
http://电脑的IPv4地址:8080/
```

例如电脑地址是 `192.168.0.106`，手机访问 `http://192.168.0.106:8080/`。电脑和手机必须在同一局域网；如果 Windows 弹出 Python 防火墙提示，只允许“专用网络”访问即可。

这种局域网 HTTP 方式适合临时测试页面、关键词组合和复制功能。它不是 HTTPS，Android Chrome 可能不会提供 PWA 安装和 Service Worker 离线能力；要长期安装到主屏幕，应使用 HTTPS 静态部署地址。

## 项目结构

```text
index.html
css/app.css                  页面样式
js/app.js                    页面交互与渲染
js/db.js                     IndexedDB 和本地降级存储
js/prompt-builder.js         Prompt 拼接和清理
js/templates.js              模板合并与描述
js/settings.js               固定要求、备份校验与导入合并
js/sync.js                   知识库加密与跨设备同步
data/keywords.json           默认关键词配置
data/presets.json            默认模板配置
drizzle/0000_prompt_sync.sql 知识库同步表结构
manifest.json                PWA 安装信息
service-worker.js            离线缓存
icons/icon.svg               App 图标
```

## 日常使用

首页是 Prompt 工作台：点击主关键词或分类 Chip，右侧（手机端在页面下方）会即时生成完整 Prompt。点击“复制 Prompt”即可复制。手机端底部固定复制按钮，桌面端右侧 Prompt 区会固定在视口附近。

模板页可以使用、收藏、置顶、重命名和删除模板。首页的“最近使用”会在复制后记录最近组合，点击即可恢复。

知识库页用于保存不能方便拆成关键词的完整 Prompt。点击“新增完整 Prompt”，填写标题和正文后保存；以后可以直接复制、收藏、置顶、编辑或删除。知识库内容也可以通过“同步更新”在手机和电脑之间手动合并。

## 修改默认关键词

打开 `data/keywords.json`，每个分类由一个 group 表示：

```json
{
  "id": "office",
  "label": "办公室",
  "text": "人物处于自然真实的办公室环境中",
  "featured": true,
  "hidden": false,
  "order": 1
}
```

- `label` 是界面上的短名称。
- `text` 是生成 Prompt 时使用的完整描述。
- `featured` 为 `true` 时会进入主关键词候选。
- `hidden` 可以隐藏默认词；日常页面不显示隐藏词。
- `order` 控制同一分类中的排序。
- group 的 `multiple` 控制这个分类是单选还是多选。

修改后刷新网页即可看到。程序更新默认配置时，不会覆盖用户在浏览器里已经保存的自定义词、隐藏状态、主关键词和编辑内容；用户修改默认词会以 IndexedDB 覆盖记录保存。

## 增加默认模板

编辑 `data/presets.json` 的 `presets` 数组。模板中的 `selectedIds` 填关键词 id，`fixedIds` 填固定要求 id：

```json
{
  "id": "preset-new",
  "name": "窗边自然版",
  "description": "窗边 · 自然光 · 轻松感",
  "selectedIds": ["balcony", "standing", "tshirt", "front", "look-camera"],
  "fixedIds": ["natural-proportions", "real-texture"],
  "order": 5
}
```

## 修改 Prompt 内容和颜色

- 修改某个默认关键词的完整描述：改 `data/keywords.json` 的 `text`。
- 修改固定要求：改 `js/settings.js` 的 `DEFAULT_FIXED_REQUIREMENTS`，或直接在设置页维护本机版本。
- 修改固定主体要求：改 `js/prompt-builder.js` 的 `BASE_SUBJECT_TEXT`。
- 修改颜色、圆角、阴影：改 `css/app.css` 顶部的 CSS 变量，例如 `--accent`、`--page`、`--card`。

## 备份和恢复

在“设置 → 备份与恢复”中点击“导出备份”，会下载 `prompt-library-backup-日期.json`。备份包含自定义关键词、关键词修改、隐藏和主关键词状态、模板、知识库、收藏、固定要求、最近使用和用户设置。同步码不会写入备份文件，它相当于知识库同步的密钥，应单独保存。

导入前会检查 JSON、版本号和基本字段。支持：

- 合并：保留当前数据，并按 id 合并导入内容。
- 覆盖：先自动下载当前数据备份，再恢复导入文件。

如果文件格式错误，当前数据不会改变。

## 知识库和免费跨设备同步

同步只针对“知识库”内容，不会把关键词、模板、固定要求或最近使用记录自动上传。它是手动同步，不是实时推送：在一台设备新增或修改后，点击“同步更新”；另一台设备再打开同一个网页并点击“同步更新”即可拉取合并。

第一次使用：

1. 在手机或电脑打开“设置 → 知识库跨设备同步”。
2. 点击“生成新码”，把显示的同步码复制保存。
3. 另一台设备打开同一个网页，在同一位置粘贴同步码并点击“保存同步码”。两台设备使用同一个同步码。
4. 任意一台设备修改知识库后点击“同步更新”，另一台设备再次点击“同步更新”。

同步内容在浏览器端先加密，再保存到同步服务；服务端不会保存知识库明文。同步码丢失后无法解开旧数据；重新生成新码会得到一个新的同步空间。同步失败时，本机知识库不会被清空或覆盖。

这个功能按当前免费配置使用，不需要账号、会员或付费计划。免费服务有用量上限，超出上限时同步会暂时失败，但首页组合、知识库查看和本地保存仍可继续使用；必要时可以使用 JSON 备份迁移全部数据。

## 手机和电脑为什么数据独立

除知识库的可选手动同步外，每个浏览器和设备都有自己的 IndexedDB。手机新增关键词、模板、固定要求不会自动出现在电脑上，这是预期行为。需要迁移全部数据时：

1. 手机上打开设置，导出 JSON 备份。
2. 把 JSON 文件发送到电脑。
3. 电脑打开同一个网页，在设置中导入备份，选择“合并”或“覆盖”。
4. 反向迁移时，步骤相同。

如果只想同步知识库，不必导入导出 JSON，使用上面的同步码即可。

## Android Chrome 添加到主屏幕

1. 用 Android Chrome 打开部署后的网页地址。
2. 等页面完成首次加载后，打开浏览器菜单。
3. 选择“添加到主屏幕”或“安装应用”。
4. 从主屏幕打开“Prompt 库”，页面会以 standalone 模式运行，核心功能可在离线状态继续使用。

部署时必须使用 HTTPS（本机 `localhost` 除外），这样 Service Worker 和 PWA 安装能力才会生效。

## 如何部署和更新

核心页面是静态站点，可以部署到 GitHub Pages、Cloudflare Pages、Vercel 或任意静态文件托管服务。把整个 `prompt-library-pwa` 文件夹作为站点根目录即可。若要使用本项目的知识库跨设备同步，部署环境还必须支持 `dist/server/index.js` 中的 `/api/sync` 接口和 `.openai/hosting.json` 里的 D1 `DB` 绑定；仅静态托管不会提供同步接口，但不影响本地功能。

更新网页时，替换 HTML、CSS、JS、JSON、`dist/server/index.js` 和 `service-worker.js` 等对应文件；同时更新 `service-worker.js` 的 `CACHE_NAME` 和资源版本号，让手机重新缓存新版本。不要清除浏览器站点数据，也不要改动 IndexedDB 的数据库名称和已有字段。IndexedDB 数据和程序文件分开，程序升级不会覆盖用户数据。正式更新前建议先在设置中导出一次 JSON 备份。

本项目当前通过 Sites 发布：先把修改后的源文件提交，再保存新的 Site 版本并发布；`drizzle/0000_prompt_sync.sql` 用于初始化同步表。发布后首次点击同步时，接口会自动确认表存在。不要切换到付费计划；免费额度不足时只会影响跨设备同步，不会删除本地数据。

## 验收建议

- 手机：检查 360px、390px、412px 宽度，复制按钮、主屏幕 standalone、刷新后数据和断网后打开。
- 桌面：检查 Windows Chrome / Edge 和 macOS Chrome / Safari，确认 900px 以上进入双栏，右侧 Prompt 预览保持可见。
- 数据：新增关键词后刷新；导出后导入；用错误 JSON 导入，确认原有数据不变。
