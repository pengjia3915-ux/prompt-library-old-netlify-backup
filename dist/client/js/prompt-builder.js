export const BASE_SUBJECT_TEXT = "主体为一名人物，整体画面自然真实，人物作为画面主体";

const GROUP_ORDER = [
  "scene",
  "pose",
  "body",
  "outfit",
  "camera",
  "composition",
  "expression",
  "hair",
  "processing",
  "other"
];

function cleanSegment(value) {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[，,；;。]+$/g, "")
    .trim();
}

function pushUnique(segments, seenTexts, value) {
  const cleaned = cleanSegment(value);
  if (!cleaned) return;
  const key = cleaned.replace(/[，,；;。\s]/g, "");
  if (seenTexts.has(key)) return;
  seenTexts.add(key);
  segments.push(cleaned);
}

export function buildPrompt({ groups = [], items = [], selectedIds = [], fixedRequirements = [] }) {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const selected = new Set(selectedIds);
  const segments = [];
  const seenTexts = new Set();

  for (const requirement of fixedRequirements.filter((item) => item && item.enabled !== false)) {
    pushUnique(segments, seenTexts, requirement.text || requirement.label);
  }

  pushUnique(segments, seenTexts, BASE_SUBJECT_TEXT);

  const orderedGroups = [
    ...GROUP_ORDER.map((id) => groupMap.get(id)).filter(Boolean),
    ...groups.filter((group) => !GROUP_ORDER.includes(group.id))
  ];

  for (const group of orderedGroups) {
    const groupItems = items.filter((item) => item.group === group.id && selected.has(item.id));
    for (const item of groupItems) {
      pushUnique(segments, seenTexts, item.text || item.label);
    }
  }

  if (!segments.length) return "";
  return `${segments.join("；")}。`;
}

export function summarizeSelection({ items = [], selectedIds = [] }) {
  const map = new Map(items.map((item) => [item.id, item]));
  return selectedIds.map((id) => map.get(id)).filter(Boolean);
}
