import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizePromptEdit } from "./js/suite-utils.js";

const bangyan = JSON.parse(await readFile(new URL("./data/bangyan-data.json", import.meta.url), "utf8"));
const prototypeSource = await readFile(new URL("./js/prototype.js", import.meta.url), "utf8");

test("常用 Prompt 作为独立直用条目导入，不参与组件组合", () => {
  const entries = bangyan.directPrompts;
  assert.equal(entries.length, 44);
  assert.deepEqual(
    Object.fromEntries([...new Set(entries.map((entry) => entry.subcategory))].map((group) => [
      group,
      entries.filter((entry) => entry.subcategory === group).length
    ])),
    {
      "职业 × 穿搭 × 场景 × 姿势": 12,
      "模特动作与姿势": 20,
      "镜头外互动": 12
    }
  );
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 44);
  assert.ok(entries.every((entry) => entry.type === "prompt" && entry.combinable === false));
  const directIds = new Set(entries.map((entry) => entry.id));
  assert.ok(bangyan.presets.every((preset) => !Object.values(preset.slots || {}).some((id) => directIds.has(id))));
  assert.equal(entries.filter((entry) => entry.negative).length, 12);
  assert.match(entries[0].positive, /专业按摩师/);
  assert.match(entries.at(-1).positive, /温柔陪伴氛围/);
  assert.equal(bangyan.counts.directPrompts, 44);
  assert.equal(bangyan.categories["姿势穿搭场景"].directPrompts, 44);
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
