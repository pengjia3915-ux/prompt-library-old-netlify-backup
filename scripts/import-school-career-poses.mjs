import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dataPath = path.join(root, "data", "bangyan-data.json");
const defaultSourcePath = path.join(root, "data", "bangyan-direct-school-career-poses.md");
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSourcePath;
const category = "原图处理";
const expectedCount = 36;

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
    if (!negative) throw new Error(`缺少反向 Prompt：${current.title}`);
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
  return [...new Set(["全身出镜", group, ...titleParts])];
}

function subcategoryFor(group) {
  return group;
}

function idPrefixFor(group) {
  if (group.includes("学院")) return "direct_fullbody_academic";
  if (group.includes("职业")) return "direct_fullbody_professional";
  if (group.includes("写真姿势")) return "direct_fullbody_pose";
  if (group.includes("第一视角")) return "direct_fullbody_pov";
  throw new Error(`未配置的内容分组：${group}`);
}

const markdown = await fs.readFile(sourcePath, "utf8");
const parsed = parseSource(markdown);
if (parsed.length !== expectedCount) throw new Error(`附件规范化 Prompt 数量应为 ${expectedCount}，实际解析到 ${parsed.length}`);

const data = JSON.parse(await fs.readFile(dataPath, "utf8"));
const existing = Array.isArray(data.directPrompts) ? data.directPrompts : [];
const existingByTitle = new Map(existing.map((entry) => [entry.title, entry]));
const existingFingerprints = new Set(existing.map((entry) => `${entry.title}\n${entry.positive}\n${entry.negative}`));
const usedIds = new Set(existing.map((entry) => entry.id));
const sequence = new Map();
const additions = [];
const replacements = new Map();
const parsedTitles = new Set();

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
  if (parsedTitles.has(entry.title)) throw new Error(`附件中存在重复标题：${entry.title}`);
  parsedTitles.add(entry.title);
  const existingEntry = existingByTitle.get(entry.title);
  const id = existingEntry?.id || nextId(entry.group);
  const expectedSubcategory = subcategoryFor(entry.group);
  const record = {
    id,
    suite: "bangyan",
    category,
    subcategory: expectedSubcategory,
    type: "prompt",
    title: entry.title,
    positive: entry.positive,
    negative: entry.negative,
    keywords: keywordsFor(entry.group, entry.title),
    combinable: false,
    enabled: true,
    exposureLevel: "medium"
  };
  const fingerprint = `${record.title}\n${record.positive}\n${record.negative}`;
  if (existingEntry) {
    if (existingEntry.category !== category) {
      throw new Error(`标题已存在但分类不一致：${entry.title}`);
    }
    if (existingEntry.subcategory !== expectedSubcategory || fingerprint !== `${existingEntry.title}\n${existingEntry.positive}\n${existingEntry.negative}`) {
      replacements.set(id, record);
    }
    continue;
  }
  if (!existingFingerprints.has(fingerprint)) additions.push(record);
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

console.log(`学院/职业/姿势 Prompt 导入完成：新增 ${additions.length} 条，覆盖 ${replacements.size} 条，保留 ${parsed.length - additions.length - replacements.size} 条；总直接 Prompt ${directPrompts.length} 条。`);
