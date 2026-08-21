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
  "manifest.json",
  "service-worker.js",
  "css/prototype.css",
  "js/prototype.js",
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

console.log("正式站点构建完成");
