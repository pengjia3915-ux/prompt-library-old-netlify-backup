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
if (parsed.length !== 28) throw new Error(`全身出镜 Prompt 数量应为 28，实际解析到 ${parsed.length}`);

const data = JSON.parse(await fs.readFile(dataPath, "utf8"));
const existing = Array.isArray(data.directPrompts) ? data.directPrompts : [];
const fingerprints = new Set(existing.map((entry) => `${entry.title}\n${entry.positive}\n${entry.negative}`));
const existingTitles = new Map(existing.map((entry) => [entry.title, `${entry.positive}\n${entry.negative}`]));
const additions = [];
const replacements = new Map();
const replacementIdByTitle = new Map([
  ["自然站姿｜深V针织上衣 + 高腰短裙 + 裸腿轻熟写真", "direct_fullbody_01"],
  ["办公室写真｜裹身交叉上衣 + 包臀短裙 + 黑色透肤丝袜", "direct_fullbody_09"],
  ["酒店房间写真｜露肩连衣裙 + 裸色丝袜", "direct_fullbody_07"],
  ["咖啡店写真｜方领修身上衣 + 短裙 + 灰色雾面丝袜", "direct_fullbody_13"],
  ["酒店走廊抓拍｜交叉领上衣 + 短裙 + 黑色长筒丝袜", "direct_fullbody_11"],
  ["沙发居家写真｜针织套装 + 深灰丝袜", "direct_fullbody_10"],
  ["酒店大堂写真｜一字肩上衣 + 高腰短裙 + 黑色丝袜", "direct_fullbody_08"],
  ["卧室清晨写真｜细肩带针织上衣 + 短裙 + 裸色丝袜", "direct_fullbody_12"],
  ["车站街拍｜不对称单肩上衣 + 百褶短裙 + 灰色丝袜", "direct_fullbody_03"],
  ["办公室第一人称视角｜深色针织上衣 + 短裙", "direct_fullbody_15"],
  ["健身房休息区｜运动套装 + 运动丝袜", "direct_fullbody_23"],
  ["机场候机厅写真｜深U针织上衣 + 高腰短裙 + 黑色透肤丝袜", "direct_fullbody_16"],
  ["高级餐厅写真｜心形领上衣 + 包臀短裙 + 灰色雾面丝袜", "direct_fullbody_17"],
  ["图书馆角落写真｜方领针织衫 + 格纹短裙 + 长筒丝袜", "direct_fullbody_18"],
  ["写字楼电梯厅｜单肩上衣 + A字短裙 + 裸色丝袜", "direct_fullbody_04"],
  ["民宿客厅写真｜露肩连衣裙 + 黑色薄丝袜", "direct_fullbody_05"],
  ["健身房镜前写真｜运动上衣 + 运动短裙 + 运动丝袜", "direct_fullbody_06"]
]);
const usedIds = new Set(existing.map((entry) => entry.id));
let nextIdNumber = Math.max(24, ...existing
  .map((entry) => entry.id.match(/^direct_fullbody_(\d+)$/u)?.[1])
  .filter(Boolean)
  .map(Number));
const parsedIds = new Set();

function nextFullbodyId() {
  do nextIdNumber += 1; while (usedIds.has(`direct_fullbody_${nextIdNumber}`));
  const id = `direct_fullbody_${nextIdNumber}`;
  usedIds.add(id);
  return id;
}

parsed.forEach((entry) => {
  const fingerprint = `${entry.title}\n${entry.positive}\n${entry.negative}`;
  const existingContent = existingTitles.get(entry.title);
  const mappedId = replacementIdByTitle.get(entry.title);
  const existingByTitle = existing.find((item) => item.title === entry.title);
  const id = mappedId || existingByTitle?.id || nextFullbodyId();
  if (parsedIds.has(id)) throw new Error(`多个新条目映射到同一稳定 ID：${id}`);
  parsedIds.add(id);
  const existingById = existing.find((item) => item.id === id);
  if (mappedId && existingByTitle && existingByTitle.id !== mappedId) {
    throw new Error(`标题已存在但稳定 ID 不符：${entry.title}`);
  }
  if (existingContent && existingContent !== `${entry.positive}\n${entry.negative}` && !existingById) {
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
  if (existingById) {
    if (existingById.title !== entry.title && !mappedId) throw new Error(`稳定 ID 冲突：${id}`);
    if (fingerprint !== `${existingById.title}\n${existingById.positive}\n${existingById.negative}`) replacements.set(id, record);
    return;
  }
  if (!fingerprints.has(fingerprint)) additions.push(record);
});

const directPrompts = [...existing.map((entry) => replacements.get(entry.id) || entry), ...additions];
const legacyGroupMap = new Map([
  ["全身出镜 · 短裙与袜装", "全身出镜 · 轻熟日常与职场"],
  ["全身出镜 · 轻熟场景写真", "全身出镜 · 场景化穿搭写真"],
  ["全身出镜 · 环境场景穿搭", "全身出镜 · 生活空间与旅行"]
]);
const classifiedDirectPrompts = directPrompts.map((entry) => {
  if (entry.category !== category || entry.subcategory !== subcategory || !Array.isArray(entry.keywords)) return entry;
  const keywords = entry.keywords.map((keyword) => legacyGroupMap.get(keyword) || keyword);
  return keywords.every((keyword, index) => keyword === entry.keywords[index]) ? entry : { ...entry, keywords: [...new Set(keywords)] };
});
const classificationChanges = classifiedDirectPrompts.filter((entry, index) => entry !== directPrompts[index]).length;
data.directPrompts = classifiedDirectPrompts;
data.schemaVersion = "1.3.0";
if (additions.length || replacements.size || classificationChanges) data.generatedAt = new Date().toISOString().slice(0, 10);
data.counts.directPrompts = classifiedDirectPrompts.length;
data.categories[category] = {
  ...(data.categories[category] || {}),
  directPrompts: classifiedDirectPrompts.filter((entry) => entry.category === category).length
};
await fs.writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

console.log(`全身出镜 Prompt 导入完成：新增 ${additions.length} 条，修正 ${replacements.size} 条，重分类 ${classificationChanges} 条，跳过已存在 ${parsed.length - additions.length - replacements.size} 条；总数 ${classifiedDirectPrompts.length} 条。`);
