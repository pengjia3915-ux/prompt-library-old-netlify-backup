import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dataPath = path.join(root, "data", "bangyan-data.json");
const defaultSourcePath = String.raw`G:\软件\夸克下载\十万+\Clippings\常用 1.md`;
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSourcePath;
const category = "姿势穿搭场景";
const numberedHeading = /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]\s*/u;

function normalizeText(value) {
  return String(value || "").replace(/^>\s?/u, "").trim();
}

function groupKey(group) {
  if (group.startsWith("职业")) return "career";
  if (group.startsWith("模特动作")) return "action";
  return "interaction";
}

function keywordsFor(group, title) {
  const parts = title.split(/[×＋+、/·\s]+/u).filter(Boolean);
  return [...new Set(["常用 Prompt", group, ...parts])];
}

function parsePrompts(markdown) {
  const entries = [];
  let currentGroup = "职业 × 穿搭 × 场景 × 姿势";
  let current = null;
  let mode = "";

  const flush = () => {
    if (!current) return;
    const positive = current.positive.join("\n").trim();
    const negative = current.negative.join("\n").trim();
    if (!positive) throw new Error(`缺少正向 Prompt：${current.title}`);
    entries.push({
      group: currentGroup,
      title: current.title,
      positive,
      negative
    });
    current = null;
    mode = "";
  };

  for (const rawLine of String(markdown).split(/\r?\n/u)) {
    const line = rawLine.trimEnd();
    const heading = line.match(/^#\s+(.+)$/u)?.[1]?.trim();
    if (heading) {
      flush();
      if (numberedHeading.test(heading)) {
        current = {
          title: heading.replace(numberedHeading, ""),
          positive: [],
          negative: []
        };
        mode = "positive";
      } else {
        currentGroup = heading.startsWith("镜头外互动") ? "镜头外互动" : heading;
      }
      continue;
    }

    const title = line.match(/^【(.+)】$/u)?.[1]?.trim();
    if (title) {
      flush();
      current = { title, positive: [], negative: [] };
      mode = "positive";
      continue;
    }

    if (line.includes("**正向 Prompt")) {
      mode = "positive";
      continue;
    }
    if (line.includes("**反向 Prompt")) {
      mode = "negative";
      continue;
    }
    if (!current || !mode || !line.trim() || line.trim() === "---") continue;
    const text = normalizeText(line);
    if (text) current[mode].push(text);
  }
  flush();
  return entries;
}

const markdown = await fs.readFile(sourcePath, "utf8");
const parsed = parsePrompts(markdown);
if (parsed.length !== 44) throw new Error(`常用 Prompt 数量应为 44，实际解析到 ${parsed.length}`);

const sequence = new Map();
const directPrompts = parsed.map((entry) => {
  const prefix = groupKey(entry.group);
  const next = (sequence.get(prefix) || 0) + 1;
  sequence.set(prefix, next);
  return {
    id: `direct_${prefix}_${String(next).padStart(2, "0")}`,
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
});

const data = JSON.parse(await fs.readFile(dataPath, "utf8"));
data.directPrompts = directPrompts;
data.schemaVersion = "1.2.0";
data.generatedAt = new Date().toISOString().slice(0, 10);
data.counts.directPrompts = directPrompts.length;
data.categories[category].directPrompts = directPrompts.length;
await fs.writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

console.log(`常用 Prompt 导入完成：${directPrompts.length} 条，分为 ${sequence.size} 组。`);
