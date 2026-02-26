import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(thisDir, "../data");
const postLogPath = path.join(dataDir, "posts.ndjson");

export async function appendPostLog(entry) {
  await mkdir(dataDir, { recursive: true });
  await appendFile(postLogPath, `${JSON.stringify(entry)}\n`, "utf8");
}

export function getPostLogPath() {
  return postLogPath;
}

