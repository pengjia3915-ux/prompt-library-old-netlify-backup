import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizePromptEdit } from "./js/suite-utils.js";

const bangyan = JSON.parse(await readFile(new URL("./data/bangyan-data.json", import.meta.url), "utf8"));
const prototypeSource = await readFile(new URL("./js/prototype.js", import.meta.url), "utf8");

test("常用 Prompt 作为独立直用条目导入，不参与组件组合", () => {
  const entries = bangyan.directPrompts;
  assert.equal(entries.length, 79);
  assert.deepEqual(
    Object.fromEntries([...new Set(entries.map((entry) => entry.subcategory))].map((group) => [
      group,
      entries.filter((entry) => entry.subcategory === group).length
    ])),
    {
      "职业 × 穿搭 × 场景 × 姿势": 12,
      "模特动作与姿势": 20,
      "镜头外互动": 12,
      "全身出镜": 35
    }
  );
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 79);
  assert.ok(entries.every((entry) => entry.type === "prompt" && entry.combinable === false));
  const directIds = new Set(entries.map((entry) => entry.id));
  assert.ok(bangyan.presets.every((preset) => !Object.values(preset.slots || {}).some((id) => directIds.has(id))));
  assert.equal(entries.filter((entry) => entry.negative).length, 47);
  assert.match(entries[0].positive, /专业按摩师/);
  assert.match(entries.find((entry) => entry.id === "direct_interaction_12").positive, /温柔陪伴氛围/);
  assert.equal(bangyan.counts.directPrompts, 79);
  assert.equal(bangyan.categories["姿势穿搭场景"].directPrompts, 44);
  assert.equal(bangyan.categories["原图处理"].directPrompts, 35);
  const fullbody = entries.filter((entry) => entry.category === "原图处理" && entry.subcategory === "全身出镜");
  assert.equal(fullbody.length, 35);
  assert.ok(fullbody.every((entry) => entry.id.startsWith("direct_fullbody_") && entry.keywords.includes("全身出镜")));
  assert.ok(fullbody.every((entry) => !entry.positive.includes("反向提示词") && entry.negative.startsWith("避免")));
  assert.equal(entries.find((entry) => entry.id === "direct_fullbody_01").title, "自然站姿｜深V针织上衣 + 高腰短裙 + 裸腿轻熟写真");
  assert.equal(entries.find((entry) => entry.id === "direct_fullbody_18").title, "图书馆角落写真｜方领针织衫 + 格纹短裙 + 长筒丝袜");
  assert.equal(entries.find((entry) => entry.id === "direct_fullbody_25").title, "图书馆知性写真｜心形领针织衫 + 格纹短裙 + 裸色丝袜");
  const fullbodyGroups = new Map();
  fullbody.forEach((entry) => {
    const group = entry.keywords.find((keyword) => keyword.startsWith("全身出镜 · "));
    fullbodyGroups.set(group, (fullbodyGroups.get(group) || 0) + 1);
  });
  assert.deepEqual(Object.fromEntries(fullbodyGroups), {
    "全身出镜 · 轻熟日常与职场": 9,
    "全身出镜 · 生活空间与旅行": 15,
    "全身出镜 · 场景化穿搭写真": 11
  });
});

test("榜眼直接 Prompt 有独立模式和可编辑覆盖类型", () => {
  assert.match(prototypeSource, /\{ id: "direct", label: "直接 Prompt" \}/u);
  assert.match(prototypeSource, /function bangyanDirectPrompts\(\)/u);
  assert.match(prototypeSource, /function bangyanCustomDirectPrompts\(\)/u);
  assert.match(prototypeSource, /state\.activeMode === "direct"/u);
  assert.match(prototypeSource, /activeMode === "direct" \? "direct" : "custom"/u);
  assert.match(prototypeSource, /makeId\(storedKind === "direct" \? "bangyan-direct-custom"/u);
  assert.match(prototypeSource, /data-action="toggle-section"/u);
  assert.match(prototypeSource, /app\.collapsedSections\.has\(sectionKey\)/u);
  assert.deepEqual(
    normalizePromptEdit({
      id: "direct_career_01",
      kind: "direct",
      title: "测试标题",
      positive: "测试 Prompt",
      negative: "",
      createdAt: "2026-08-26T00:00:00.000Z",
      updatedAt: "2026-08-26T00:00:00.000Z"
    }),
    {
      id: "direct_career_01",
      kind: "direct",
      title: "测试标题",
      positive: "测试 Prompt",
      negative: "",
      createdAt: "2026-08-26T00:00:00.000Z",
      updatedAt: "2026-08-26T00:00:00.000Z"
    }
  );
});
