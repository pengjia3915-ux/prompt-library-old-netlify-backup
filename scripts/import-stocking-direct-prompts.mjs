import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dataPath = path.join(root, "data", "bangyan-data.json");
const defaultSourcePath = path.join(root, "data", "bangyan-direct-stocking-batches.md");
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSourcePath;
const category = "原图处理";
const expectedCounts = new Map([
  ["纯-丝袜", 12],
  ["丝袜穿搭", 18],
  ["性感凉爽穿搭", 20],
  ["穿搭丝袜-2", 20]
]);

function parseSource(markdown) {
  const entries = [];
  let group = "";
  let current = null;
  let mode = "";

  const flush = () => {
    if (!current) return;
    const positive = current.positive.join("\n").trim();
    const negative = current.negative
      .filter(Boolean)
      .map((value) => value.startsWith("避免") ? value : `避免${value}`)
      .join("\n")
      .trim();
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
      if (positiveLabel[1]) current?.positive.push(positiveLabel[1].trim());
      continue;
    }
    const negativeLabel = line.trim().match(/^反向提示词：\s*(.*)$/u);
    if (negativeLabel) {
      mode = "negative";
      if (negativeLabel[1]) current?.negative.push(negativeLabel[1].trim());
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
  return [...new Set([group, ...titleParts])];
}

function idPrefixFor(group) {
  if (group === "纯-丝袜") return "direct_pure_socks";
  if (group === "丝袜穿搭") return "direct_stockings_outfit";
  if (group === "性感凉爽穿搭") return "direct_sexy_cool";
  if (group === "穿搭丝袜-2") return "direct_stockings_outfit_2";
  throw new Error(`未配置的内容分组：${group}`);
}

const markdown = await fs.readFile(sourcePath, "utf8");
const parsed = parseSource(markdown);
const actualCounts = new Map();
for (const entry of parsed) actualCounts.set(entry.group, (actualCounts.get(entry.group) || 0) + 1);
if (parsed.length !== 70) throw new Error(`四批 Prompt 总数应为 70，实际解析到 ${parsed.length}`);
for (const [group, expected] of expectedCounts) {
  if (actualCounts.get(group) !== expected) throw new Error(`${group} 应为 ${expected} 条，实际解析到 ${actualCounts.get(group) || 0} 条`);
}
if ([...actualCounts.keys()].some((group) => !expectedCounts.has(group))) {
  throw new Error(`发现未配置的内容分组：${[...actualCounts.keys()].filter((group) => !expectedCounts.has(group)).join("、")}`);
}

const data = JSON.parse(await fs.readFile(dataPath, "utf8"));
const existing = Array.isArray(data.directPrompts) ? data.directPrompts : [];
const existingByTitle = new Map(existing.map((entry) => [entry.title, entry]));
const existingByContent = new Map(existing.map((entry) => [`${entry.positive}\n${entry.negative}`, entry]));
const usedIds = new Set(existing.map((entry) => entry.id));
const parsedTitles = new Set();
const parsedContent = new Set();
const sequence = new Map();
const additions = [];
const replacements = new Map();
const unchanged = [];

function nextId(group) {
  const prefix = idPrefixFor(group);
  let next = (sequence.get(prefix) || 0) + 1;
  let id = `${prefix}_${String(next).padStart(2, "0")}`;
  while (usedIds.has(id)) {
    next += 1;
    id = `${prefix}_${String(next).padStart(2, "0")}`;
  }
  sequence.set(prefix, next);
  usedIds.add(id);
  return id;
}

for (const entry of parsed) {
  if (parsedTitles.has(entry.title)) throw new Error(`三批内容中存在重复标题：${entry.title}`);
  parsedTitles.add(entry.title);
  const contentKey = `${entry.positive}\n${entry.negative}`;
  if (parsedContent.has(contentKey)) throw new Error(`三批内容中存在重复正文：${entry.title}`);
  parsedContent.add(contentKey);

  const existingEntry = existingByTitle.get(entry.title);
  const sameContentEntry = existingByContent.get(contentKey);
  if (!existingEntry && sameContentEntry) {
    throw new Error(`正文已存在但标题不同，请先人工确认是否覆盖：${entry.title} / ${sameContentEntry.title}`);
  }

  const id = existingEntry?.id || nextId(entry.group);
  const record = {
    id,
    suite: "bangyan",
    category,
    subcategory: entry.group,
    type: "prompt",
    title: entry.title,
    positive: entry.positive,
    negative: entry.negative,
    keywords: keywordsFor(entry.group, entry.title),
    combinable: false,
    enabled: true,
    exposureLevel: "medium"
  };

  if (existingEntry) {
    if (existingEntry.category !== category) throw new Error(`标题已存在但分类不一致：${entry.title}`);
    if (existingEntry.subcategory !== entry.group || `${existingEntry.positive}\n${existingEntry.negative}` !== contentKey) {
      replacements.set(id, record);
    } else {
      unchanged.push(entry.title);
    }
    continue;
  }
  additions.push(record);
}

const directPrompts = [...existing.map((entry) => replacements.get(entry.id) || entry), ...additions];
if (new Set(directPrompts.map((entry) => entry.id)).size !== directPrompts.length) throw new Error("直接 Prompt ID 出现重复");
if (new Set(directPrompts.map((entry) => entry.title)).size !== directPrompts.length) throw new Error("直接 Prompt 标题出现重复");

data.directPrompts = directPrompts;
data.schemaVersion = "1.3.0";
data.generatedAt = new Date().toISOString().slice(0, 10);
data.counts.directPrompts = directPrompts.length;
data.categories[category] = {
  ...(data.categories[category] || {}),
  directPrompts: directPrompts.filter((entry) => entry.category === category).length
};
await fs.writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

const resultCounts = Object.fromEntries([...expectedCounts.keys()].map((group) => [
  group,
  directPrompts.filter((entry) => entry.subcategory === group).length
]));
console.log(`四批丝袜 Prompt 导入完成：新增 ${additions.length} 条，覆盖 ${replacements.size} 条，原样保留 ${unchanged.length} 条；总直接 Prompt ${directPrompts.length} 条。`);
console.log(JSON.stringify(resultCounts, null, 2));
