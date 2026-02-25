import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const contentMap = new Map<string, string>();
let loadedFromDisk = false;

function normalizeHash(hash: string): string {
  return hash.trim().toLowerCase();
}

function resolveContentMapPath(): string {
  return path.resolve(process.cwd(), "data/content-map.json");
}

async function loadFromDiskIfNeeded(): Promise<void> {
  if (loadedFromDisk) {
    return;
  }

  loadedFromDisk = true;
  const filePath = resolveContentMapPath();

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [hash, text] of Object.entries(parsed)) {
      if (typeof text !== "string") {
        continue;
      }

      const normalized = normalizeHash(hash);
      const cleaned = text.trim();
      if (normalized.length === 0 || cleaned.length === 0) {
        continue;
      }
      contentMap.set(normalized, cleaned);
    }
  } catch {
    // Ignore missing/invalid file and keep an in-memory map only.
  }
}

async function persistToDisk(): Promise<boolean> {
  const filePath = resolveContentMapPath();

  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    const serialized = JSON.stringify(Object.fromEntries(contentMap.entries()), null, 2);
    await writeFile(filePath, `${serialized}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

export async function getContentTextByHash(hash: string): Promise<string | undefined> {
  await loadFromDiskIfNeeded();
  return contentMap.get(normalizeHash(hash));
}

export async function getContentMapSnapshot(): Promise<Map<string, string>> {
  await loadFromDiskIfNeeded();
  return new Map(contentMap.entries());
}

export async function upsertContentMapEntry(args: {
  contentUriHash: string;
  contentText: string;
}): Promise<{ persisted: boolean }> {
  await loadFromDiskIfNeeded();

  const normalizedHash = normalizeHash(args.contentUriHash);
  const normalizedText = args.contentText.trim();

  if (normalizedHash.length === 0 || normalizedText.length === 0) {
    return { persisted: false };
  }

  contentMap.set(normalizedHash, normalizedText);
  const persisted = await persistToDisk();
  return { persisted };
}

export async function getContentMapStats(): Promise<{ entries: number; loadedFromDisk: boolean }> {
  await loadFromDiskIfNeeded();
  return {
    entries: contentMap.size,
    loadedFromDisk
  };
}

