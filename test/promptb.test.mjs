import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  composeBangyanPreset,
  composeBangyanSelection,
  emptyBuilder,
  favoriteKey,
  migrateLegacyPrototypeState,
  mergeSyncedSuiteState,
  normalizeCloudPayload,
  selectBuilderComponent,
  searchMatches,
  suiteStateKey
} from "../js/suite-utils.js";

const bangyan = JSON.parse(await readFile(new URL("../data/bangyan-data.json", import.meta.url), "utf8"));
const zhuangyuan = JSON.parse(await readFile(new URL("../data/img2img-prompts.json", import.meta.url), "utf8"));
const components = bangyan.components;
const componentMap = new Map(components.map((component) => [component.id, component]));
const prototypeSource = await readFile(new URL("../js/prototype.js", import.meta.url), "utf8");

test("榜眼正式数据数量和分类保持正式值", () => {
  assert.equal(components.length, 235);
  assert.equal(bangyan.presets.length, 24);
  assert.deepEqual(Object.keys(bangyan.categories), ["原图处理", "发型发色", "姿势穿搭场景"]);
  const categoryCounts = components.reduce((counts, component) => {
    counts[component.category] = (counts[component.category] || 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(
    categoryCounts,
    { 原图处理: 18, 发型发色: 36, 姿势穿搭场景: 181 }
  );
  assert.equal(components.filter((component) => component.subcategory === "表情").length, 20);
  assert.equal(components.filter((component) => component.subcategory === "姿势").length, 76);
  assert.equal(components.filter((component) => component.subcategory === "机位").length, 12);
  assert.equal(components.filter((component) => component.subcategory === "视角").length, 10);
  assert.deepEqual(
    components
      .filter((component) => component.subcategory === "姿势")
      .slice(0, 3)
      .map((component) => component.id),
    ["pose_04", "pose_05", "pose_17"]
  );
  assert.deepEqual(
    components
      .filter((component) => component.subcategory === "姿势")
      .slice(-10)
      .map((component) => component.id),
    ["pose_57", "pose_58", "pose_59", "pose_60", "pose_61", "pose_62", "pose_63", "pose_64", "pose_06", "pose_07"]
  );
  assert.equal(components.filter((component) => component.id.startsWith("selfie_")).length, 12);
  assert.ok(componentMap.get("selfie_01").keywords.includes("自拍姿势"));
  assert.equal(components.filter((component) => component.subcategory === "穿搭").length, 43);
  assert.equal(components.filter((component) => /^outfit_(0[9]|[1-4][0-9])$/.test(component.id)).length, 35);
  assert.match(componentMap.get("outfit_09").title, /^性感风 · /);
  assert.ok(componentMap.get("outfit_09").keywords.includes("性感风"));
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

test("表情、机位、视角作为独立 slot 可拼合并互相替换", () => {
  let builder = emptyBuilder();
  for (const id of ["expr_01", "expr_02", "pose_09", "campos_01", "camview_01"]) {
    builder = selectBuilderComponent(builder, componentMap.get(id));
  }
  assert.equal(builder.expression, "expr_02");
  assert.equal(builder.cameraPosition, "campos_01");
  assert.equal(builder.cameraView, "camview_01");
  const composed = composeBangyanSelection({ components, selection: builder, compositionRules: bangyan.compositionRules });
  assert.deepEqual(composed.componentIds, ["expr_02", "pose_09", "campos_01", "camview_01"]);
  assert.match(composed.positive, /闭唇浅笑/);
  assert.match(composed.positive, /平视全身机位/);
  assert.match(composed.positive, /正面取景/);
  assert.match(composed.negative, /换脸/);
});

test("颜色配置作为可选 builder 元数据保留，且不改变正式组件合成", () => {
  let builder = emptyBuilder();
  builder.colorMode = "matching";
  builder.colorStyle = "burgundy";
  builder = selectBuilderComponent(builder, componentMap.get("outfit_01"));
  assert.equal(builder.colorMode, "matching");
  assert.equal(builder.colorStyle, "burgundy");
  assert.doesNotMatch(composeBangyanSelection({ components, selection: builder }).positive, /酒红/);
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

test("搜索条目渲染不引用未定义的 id", () => {
  const searchEntrySource = prototypeSource.match(/function searchEntry\(kind, entry\) \{[\s\S]*?\n\}\n\nfunction compactSummary/)?.[0] || "";
  assert.notEqual(searchEntrySource, "");
  assert.doesNotMatch(searchEntrySource, /hasPromptEdit\(kind, id\)/);
});

test("自由拼装状态按更新时间同步", () => {
  const local = {
    builder: { outfit: "outfit_01", colorMode: "uniform", colorStyle: "black" },
    builderUpdatedAt: "2026-08-21T10:00:00.000Z"
  };
  const remote = {
    builder: { outfit: "outfit_02", colorMode: "matching", colorStyle: "burgundy" },
    builderUpdatedAt: "2026-08-21T10:01:00.000Z"
  };
  const merged = mergeSyncedSuiteState(local, remote);
  assert.equal(merged.builder.outfit, "outfit_02");
  assert.equal(merged.builder.colorStyle, "burgundy");
  assert.equal(merged.builderUpdatedAt, remote.builderUpdatedAt);

  const localWins = mergeSyncedSuiteState(
    { ...local, builderUpdatedAt: "2026-08-21T10:02:00.000Z" },
    remote
  );
  assert.equal(localWins.builder.outfit, "outfit_01");
  assert.equal(localWins.builderUpdatedAt, "2026-08-21T10:02:00.000Z");
});

test("静态编辑覆盖和收藏组合按记录更新时间同步", () => {
  const local = {
    promptEdits: [{
      id: "prompt_01",
      kind: "prompt",
      title: "本机标题",
      positive: "本机 Prompt",
      negative: "",
      updatedAt: "2026-08-21T10:00:00.000Z"
    }],
    savedCompositions: [{
      id: "composition_01",
      title: "本机组合",
      positive: "本机组合 Prompt",
      negative: "",
      updatedAt: "2026-08-21T10:00:00.000Z"
    }]
  };
  const remote = {
    promptEdits: [{
      id: "prompt_01",
      kind: "prompt",
      title: "远端标题",
      positive: "远端 Prompt",
      negative: "远端反向",
      updatedAt: "2026-08-21T10:01:00.000Z"
    }],
    savedCompositions: [{
      id: "composition_01",
      title: "远端组合",
      positive: "远端组合 Prompt",
      negative: "",
      updatedAt: "2026-08-21T10:01:00.000Z"
    }]
  };
  const merged = mergeSyncedSuiteState(local, remote);
  assert.equal(merged.promptEdits[0].title, "远端标题");
  assert.equal(merged.promptEdits[0].negative, "远端反向");
  assert.equal(merged.savedCompositions[0].title, "远端组合");

  const deleted = mergeSyncedSuiteState(local, {
    promptEdits: [{
      id: "prompt_01",
      kind: "prompt",
      deletedAt: "2026-08-21T10:02:00.000Z",
      updatedAt: "2026-08-21T10:02:00.000Z"
    }]
  });
  assert.equal(deleted.promptEdits[0].deletedAt, "2026-08-21T10:02:00.000Z");
});




