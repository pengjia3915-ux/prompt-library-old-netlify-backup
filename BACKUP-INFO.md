# Prompt 库｜旧 Netlify 版｜独立 Git 备份

## 来源

- 线上地址：https://prompt-library-pengjia3915.netlify.app/
- Netlify Site ID：`b897359f-4774-462c-96f6-4f5263da9211`
- 已知发布方式：Netlify CLI 手动发布
- 备份基准提交：`a465d281f886c6b3a77df490f5d2034fc5841934`
- 备份基准日期：2026-08-11

## 这份备份包含什么

- 完整 Git 提交历史
- 网页源码
- 默认 Prompt 数据
- `dist/client` 构建产物
- Netlify 配置和同步函数
- 项目 README 与依赖文件

## 重要边界

这份备份不包含浏览器 IndexedDB 中的个人置顶、收藏、自定义 Prompt、模板和最近使用记录，也不包含 Netlify 账号后台数据。个人数据需要在旧 Netlify 页面内通过“设置 → 导出备份”另行保存。

原仓库中未跟踪的 `open-design-preview.html` 和 `prototype.html` 没有混入这份生产备份；它们属于原型候选文件，不属于旧 Netlify 的 Git 提交状态。

## 恢复方式

在其他环境中复制或 clone 本目录后，可以从 Git 历史继续修改。恢复旧 Netlify 线上版本时，应先确认目标 Site ID，避免误部署到当前正式 Sites 项目。
