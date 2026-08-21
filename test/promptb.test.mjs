import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  composeBangyanPreset,
  composeBangyanSelection,
  emptyBuilder,
  favoriteKey,
  migrateLegacyPrototypeState,
  normalizeCloudPayload,
  selectBuilderComponent,
  searchMatches,
  suiteStateKey
} from "../js/suite-utils.js";

const bangyan = JSON.parse(await readFile(new URL("../data/bangyan-data.json", import.meta.url), "utf8"));
const zhuangyuan = JSON.parse(await readFile(new URL("../data/img2img-prompts.json", import.meta.url), "utf8"));
const components = bangyan.components;
const componentMap = new Map(components.map((component) => [component.id, component]));

test("榜眼正式数据数量和分类保持冻结值", () => {
  assert.equal(components.length, 90);
  assert.equal(bangyan.presets.length, 24);
  assert.deepEqual(Object.keys(bangyan.categories), ["原图处理", "发型发色", "姿势穿搭场景"]);
  const categoryCounts = components.reduce((counts, component) => {
    counts[component.category] = (counts[component.category] || 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(
    categoryCounts,
    { 原图处理: 18, 发型发色: 36, 姿势穿搭场景: 36 }
  );
});

test("状元旧数据数量和空的大尺度栏目保持不变", () => {
  assert.equal(zhuangyuan.prompts.length, 251);
  assert.deepEqual(
    Object.fromEntries(zhuangyuan.categories.map((category) => [
      category.name,
      zhuangyuan.prompts.filter((entry) => entry.categoryId === category.id).length
    ])),
    { 原图处理: 34, 姿势场景: 201, 纯穿搭: 16, 大尺度: 0 }
  );
});

test("所有榜眼 preset 引用都能解析到 component", () => {
  for (const preset of bangyan.presets) {
    for (const componentId of Object.values(preset.slots)) {
      if (componentId) assert.ok(componentMap.has(componentId), `${preset.id} -> ${componentId}`);
    }
  }
});

test("状态 key 和收藏 key 按 suite/entry 身份区分", () => {
  assert.notEqual(suiteStateKey("zhuangyuan"), suiteStateKey("bangyan"));
  assert.equal(favoriteKey("prompt", "厨房"), "prompt:厨房");
  assert.notEqual(favoriteKey("prompt", "same-id"), favoriteKey("component", "same-id"));
});

test("旧 prototype state 只迁移到状元", () => {
  const migrated = migrateLegacyPrototypeState({
    prompts: [{ id: "custom-1", title: "旧自定义", prompt: "旧内容" }],
    activeCategoryId: "image-edit",
    syncCode: "abc"
  });
  assert.equal(migrated.suite, "zhuangyuan");
  assert.equal(migrated.prompts[0].id, "custom-1");
  assert.equal(migrated.syncCode, "abc");
});

test("旧云同步 payload 只解释为状元", () => {
  const normalized = normalizeCloudPayload({ version: 1, entries: [{ id: "old", title: "旧", prompt: "内容" }] });
  assert.equal(normalized.schemaVersion, 2);
  assert.equal(normalized.suites.zhuangyuan.prompts[0].id, "old");
  assert.equal(normalized.suites.bangyan, null);
});

test("发型、发色、眼镜同 slot 新选择替换旧选择", () => {
  let builder = emptyBuilder();
  builder = selectBuilderComponent(builder, componentMap.get("hair_01"));
  builder = selectBuilderComponent(builder, componentMap.get("hair_02"));
  builder = selectBuilderComponent(builder, componentMap.get("color_04"));
  builder = selectBuilderComponent(builder, componentMap.get("glasses_01"));
  assert.equal(builder.hairstyle, "hair_02");
  assert.equal(builder.hairColor, "color_04");
  assert.equal(builder.glasses, "glasses_01");
  assert.equal(composeBangyanSelection({ components, selection: builder }).componentIds.includes("hair_01"), false);
});

test("姿势、穿搭、领口、场景同 slot 新选择替换旧选择", () => {
  let builder = emptyBuilder();
  for (const id of ["pose_01", "pose_02", "outfit_01", "neck_01", "scene_01"]) {
    builder = selectBuilderComponent(builder, componentMap.get(id));
  }
  assert.equal(builder.pose, "pose_02");
  assert.equal(builder.outfit, "outfit_01");
  assert.equal(builder.neckline, "neck_01");
  assert.equal(builder.scene, "scene_01");
});

test("独立领口覆盖穿搭内部领口描述", () => {
  const preset = bangyan.presets.find((item) => item.id === "stylepreset_01");
  const composed = composeBangyanPreset(preset, components);
  assert.match(composed.positive, /深V领/);
  assert.doesNotMatch(composed.positive, /领口允许后续用独立领口组件覆盖/);
});

test("重复标题不会被当成唯一身份", () => {
  const kitchen = zhuangyuan.prompts.filter((entry) => entry.title === "厨房");
  assert.equal(kitchen.length, 2);
  assert.notEqual(kitchen[0].id, kitchen[1].id);
  assert.equal(kitchen.filter((entry) => searchMatches(entry, "厨房")).length, 2);
});
