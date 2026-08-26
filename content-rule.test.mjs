import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  componentSlot,
  composeBangyanSelection,
  emptyBuilder,
  isDisplayOnlyComponent,
  selectBuilderComponent
} from "./js/suite-utils.js";

const bangyan = JSON.parse(await readFile(new URL("./data/bangyan-data.json", import.meta.url), "utf8"));
const components = bangyan.components;
const componentMap = new Map(components.map((component) => [component.id, component]));

test("胸型调整仅供辨认，不进入自由拼装正文", () => {
  const bust = componentMap.get("orig_bust_01");
  assert.equal(isDisplayOnlyComponent(bust), true);
  assert.equal(componentSlot(bust), "displayOnly");

  const selected = selectBuilderComponent(emptyBuilder(), bust);
  assert.deepEqual(selected.original, []);

  const composed = composeBangyanSelection({
    components,
    selection: { ...emptyBuilder(), original: ["orig_bust_01"], neckline: "neck_01" },
    compositionRules: bangyan.compositionRules
  });
  assert.equal(composed.componentIds.includes("orig_bust_01"), false);
  assert.doesNotMatch(composed.positive, /自然丰满、重心合理/);
});

test("领口组件只描述服装结构，公共体型基线只出现一次", () => {
  const necklines = components.filter((component) => component.subcategory === "领口");
  assert.equal(necklines.length, 12);
  assert.ok(necklines.every((component) => !/乳沟|胸前区域|胸前线条|胸部/.test(`${component.positive}${component.composeText}`)));

  const composed = composeBangyanSelection({
    components,
    selection: { ...emptyBuilder(), outfit: "outfit_04", neckline: "neck_01" },
    compositionRules: bangyan.compositionRules
  });
  assert.equal((composed.positive.match(/身材丰满/g) || []).length, 1);
  assert.match(composed.positive, /自然衣物褶皱/);
  assert.doesNotMatch(composed.positive, /胸前区域|乳沟/);
});
