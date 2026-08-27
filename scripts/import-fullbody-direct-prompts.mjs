import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dataPath = path.join(root, "data", "bangyan-data.json");
const defaultSourcePath = path.join(root, "data", "bangyan-direct-fullbody.md");
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSourcePath;
const category = "原图处理";
const subcategory = "全身出镜";

function parseSource(markdown) {
  const entries = [];
  let group = "";
  let commonNegative = "";
  let current = null;
  let mode = "";

  const flush = () => {
    if (!current) return;
    const positive = current.positive.join("\n").trim();
    const specificNegative = current.negative
      .filter(Boolean)
      .map((value) => value.startsWith("避免") ? value : `避免${value}`);
    const negative = [...specificNegative, commonNegative].filter(Boolean).join("\n").trim();
    if (!positive) throw new Error(`缺少正向 Prompt：${current.title}`);
    entries.push({ group, title: current.title, positive, negative });
    current = null;
    mode = "";
  };

  for (const rawLine of String(markdown).split(/\r?\n/u)) {
    const line = rawLine.trimEnd();
    const groupHeading = line.match(/^#\s+(.+)$/u)?.[1]?.trim();
    if (groupHeading) {
      flush();
      group = groupHeading;
      commonNegative = "";
      continue;
    }

    const common = line.match(/^通用反向提示词：\s*(.*)$/u);
    if (common) {
      commonNegative = common[1].trim();
      continue;
    }

    const title = line.match(/^##\s+(.+)$/u)?.[1]?.trim();
    if (title) {
      flush();
      current = { title, positive: [], negative: [] };
      mode = "";
      continue;
    }

    const positiveLabel = line.trim().match(/^正向提示词：\s*(.*)$/u);
    if (positiveLabel) {
      mode = "positive";
      if (positiveLabel[1]) current.positive.push(positiveLabel[1].trim());
      continue;
    }
    const negativeLabel = line.trim().match(/^反向提示词：\s*(.*)$/u);
    if (negativeLabel) {
      mode = "negative";
      if (negativeLabel[1]) current.negative.push(negativeLabel[1].trim());
      continue;
    }
    if (!current || !mode || !line.trim()) continue;
    current[mode].push(line.trim());
  }
  flush();
  return entries;
}

function keywordsFor(group, title) {
  const titleParts = title.split(/[｜＋+×/、·\s]+/u).filter(Boolean);
  return [...new Set(["全身出镜", group, ...titleParts])];
}

const markdown = await fs.readFile(sourcePath, "utf8");
const parsed = parseSource(markdown);
if (parsed.length !== 24) throw new Error(`全身出镜 Prompt 数量应为 24，实际解析到 ${parsed.length}`);

const data = JSON.parse(await fs.readFile(dataPath, "utf8"));
const existing = Array.isArray(data.directPrompts) ? data.directPrompts : [];
const fingerprints = new Set(existing.map((entry) => `${entry.title}\n${entry.positive}\n${entry.negative}`));
const existingTitles = new Map(existing.map((entry) => [entry.title, `${entry.positive}\n${entry.negative}`]));
const additions = [];
const replacements = new Map();

parsed.forEach((entry, index) => {
  const fingerprint = `${entry.title}\n${entry.positive}\n${entry.negative}`;
  const existingContent = existingTitles.get(entry.title);
  const id = `direct_fullbody_${String(index + 1).padStart(2, "0")}`;
  if (existingContent && existingContent !== `${entry.positive}\n${entry.negative}` && !existing.some((item) => item.id === id)) {
    throw new Error(`标题冲突，已有内容不同：${entry.title}`);
  }
  const record = {
    id,
    suite: "bangyan",
    category,
    subcategory,
    type: "prompt",
    title: entry.title,
    positive: entry.positive,
    negative: entry.negative,
    keywords: keywordsFor(entry.group, entry.title),
    combinable: false,
    enabled: true,
    exposureLevel: "medium"
  };
  const existingById = existing.find((item) => item.id === id);
  if (existingById) {
    if (existingById.title !== entry.title) throw new Error(`稳定 ID 冲突：${id}`);
    if (fingerprint !== `${existingById.title}\n${existingById.positive}\n${existingById.negative}`) replacements.set(id, record);
    return;
  }
  if (!fingerprints.has(fingerprint)) additions.push(record);
});

const directPrompts = [...existing.map((entry) => replacements.get(entry.id) || entry), ...additions];
data.directPrompts = directPrompts;
data.schemaVersion = "1.3.0";
if (additions.length) data.generatedAt = new Date().toISOString().slice(0, 10);
data.counts.directPrompts = directPrompts.length;
data.categories[category] = {
  ...(data.categories[category] || {}),
  directPrompts: directPrompts.filter((entry) => entry.category === category).length
};
await fs.writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

console.log(`全身出镜 Prompt 导入完成：新增 ${additions.length} 条，修正 ${replacements.size} 条，跳过已存在 ${parsed.length - additions.length - replacements.size} 条；总数 ${directPrompts.length} 条。`);
