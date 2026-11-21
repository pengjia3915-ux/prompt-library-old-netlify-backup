import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const client = path.join(dist, "client");
const server = path.join(dist, "server");

await fs.rm(client, { recursive: true, force: true });
await fs.mkdir(client, { recursive: true });
await fs.mkdir(server, { recursive: true });
await fs.mkdir(path.join(dist, ".openai"), { recursive: true });

for (const file of [
  "index.html",
  "_redirects",
  "pose-reference.html",
  "costume-reference.html",
  "css/costume-reference.css",
  "js/costume-reference.js",
  "js/costume-model.js",
  "data/costume-reference/catalog.json",
  "data/costume-reference/text-prompts.json",
  "data/costume-reference/SOURCE.md",
  "css/pose-reference.css",
  "js/pose-reference.js",
  "js/pose-model.js",
  "manifest.json",
  "service-worker.js",
  "css/prototype.css",
  "css/studio.css",
  "css/workbench.css",
  "js/catalog.js",
  "js/browse-model.js",
  "js/families.js",
  "data/catalog-map.json",
  "js/prototype.js",
  "js/back-to-top.js",
  "js/suite-utils.js",
  "js/storage.js",
  "js/sync.js",
  "data/img2img-prompts.json",
  "data/bangyan-data.json",
  "icons/icon.svg",
]) {
  const destination = path.join(client, file);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(path.join(root, file), destination);
}

await fs.copyFile(path.join(root, "server", "index.js"), path.join(server, "index.js"));
await fs.copyFile(path.join(root, ".openai", "hosting.json"), path.join(dist, ".openai", "hosting.json"));

await fs.cp(path.join(root,"data/pose-reference"),path.join(client,"data/pose-reference"),{recursive:true});
await fs.cp(
  path.join(root, "data/costume-reference/designs"),
  path.join(client, "data/costume-reference/designs"),
  { recursive: true }
);
const forbidden = /(^|\/)(?:reports|backups|scene-reference|costume-caption-review)(?:\/|\.)|(?:^|\/)sheet-\d+\.jpg$/i;
async function verifyReleaseFiles(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    const relative = path.relative(client, target).replaceAll('\\', '/');
    if (forbidden.test(relative)) throw new Error(`试用或复核材料不能发布: ${relative}`);
    if (entry.isDirectory()) await verifyReleaseFiles(target);
  }
}
await verifyReleaseFiles(client);
console.log("正式站点构建完成（场景试用和复核材料已排除）");
