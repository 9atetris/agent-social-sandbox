import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type StorageMode = "kv" | "file";

type KvConfig = {
  url: string;
  readToken: string;
  writeToken?: string;
  keyPrefix: string;
  keyIndex: string;
};

const fileContentMap = new Map<string, string>();
let loadedFromDisk = false;

function normalizeHash(hash: string): string {
  return hash.trim().toLowerCase();
}

function resolveKvConfig(): KvConfig | undefined {
  const url = (
    process.env.KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_REST_URL ??
    ""
  ).trim();
  const writeToken = (
    process.env.KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    ""
  ).trim();
  const readToken = (
    process.env.KV_REST_API_READ_ONLY_TOKEN ??
    writeToken
  ).trim();

  if (!url || !readToken) {
    return undefined;
  }

  const rawPrefix = (process.env.AGENT_CONTENT_MAP_PREFIX ?? "forum:content_map:").trim();
  const keyPrefix = rawPrefix.endsWith(":") ? rawPrefix : `${rawPrefix}:`;
  const keyIndex = `${keyPrefix}__keys`;

  return {
    url,
    readToken,
    writeToken: writeToken || undefined,
    keyPrefix,
    keyIndex
  };
}

const kvConfig = resolveKvConfig();

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
      fileContentMap.set(normalized, cleaned);
    }
  } catch {
    // Ignore missing/invalid file and keep an in-memory map only.
  }
}

async function persistToDisk(): Promise<boolean> {
  const filePath = resolveContentMapPath();

  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    const serialized = JSON.stringify(Object.fromEntries(fileContentMap.entries()), null, 2);
    await writeFile(filePath, `${serialized}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

function getKvDataKey(normalizedHash: string): string {
  if (!kvConfig) {
    return normalizedHash;
  }
  return `${kvConfig.keyPrefix}${normalizedHash}`;
}

async function runKvCommand(command: string[], mode: "read" | "write"): Promise<unknown> {
  if (!kvConfig) {
    throw new Error("kv_not_configured");
  }

  const token = mode === "write" ? kvConfig.writeToken ?? kvConfig.readToken : kvConfig.readToken;
  if (!token) {
    throw new Error("kv_token_not_configured");
  }

  const response = await fetch(kvConfig.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      command
    }),
    cache: "no-store"
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`kv_invalid_json_response: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`kv_http_${response.status}: ${JSON.stringify(payload).slice(0, 200)}`);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("kv_invalid_payload");
  }

  const asRecord = payload as Record<string, unknown>;
  if ("error" in asRecord && asRecord.error) {
    throw new Error(`kv_error: ${JSON.stringify(asRecord.error).slice(0, 200)}`);
  }

  return asRecord.result;
}

function parseCountValue(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.max(0, Math.round(input));
  }
  if (typeof input === "string") {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }
  return 0;
}

async function getFromKvByHashes(normalizedHashes: string[]): Promise<Map<string, string>> {
  if (!kvConfig || normalizedHashes.length === 0) {
    return new Map();
  }

  const keys = normalizedHashes.map((hash) => getKvDataKey(hash));
  const result = await runKvCommand(["MGET", ...keys], "read");
  if (!Array.isArray(result)) {
    return new Map();
  }

  const map = new Map<string, string>();
  for (let i = 0; i < result.length; i += 1) {
    const value = result[i];
    if (typeof value !== "string") {
      continue;
    }

    const cleaned = value.trim();
    if (!cleaned) {
      continue;
    }

    map.set(normalizedHashes[i], cleaned);
  }

  return map;
}

export async function getContentTextByHash(hash: string): Promise<string | undefined> {
  const map = await getContentTextsByHashes([hash]);
  return map.get(normalizeHash(hash));
}

export async function getContentTextsByHashes(hashes: string[]): Promise<Map<string, string>> {
  const normalizedHashes = Array.from(new Set(hashes.map((hash) => normalizeHash(hash)).filter((hash) => hash.length > 0)));
  if (normalizedHashes.length === 0) {
    return new Map();
  }

  if (kvConfig) {
    try {
      const kvMap = await getFromKvByHashes(normalizedHashes);
      if (kvMap.size > 0) {
        return kvMap;
      }
    } catch {
      // Fall through to file storage for resilience when KV is temporarily unavailable.
    }
  }

  await loadFromDiskIfNeeded();
  const map = new Map<string, string>();
  for (const hash of normalizedHashes) {
    const text = fileContentMap.get(hash);
    if (!text) {
      continue;
    }
    map.set(hash, text);
  }
  return map;
}

export async function upsertContentMapEntry(args: {
  contentUriHash: string;
  contentText: string;
}): Promise<{ persisted: boolean; mode: StorageMode }> {
  const normalizedHash = normalizeHash(args.contentUriHash);
  const normalizedText = args.contentText.trim();

  if (!normalizedHash || !normalizedText) {
    return { persisted: false, mode: kvConfig ? "kv" : "file" };
  }

  if (kvConfig) {
    await runKvCommand(["SET", getKvDataKey(normalizedHash), normalizedText], "write");
    await runKvCommand(["SADD", kvConfig.keyIndex, normalizedHash], "write");
    return { persisted: true, mode: "kv" };
  }

  await loadFromDiskIfNeeded();
  fileContentMap.set(normalizedHash, normalizedText);
  const persisted = await persistToDisk();
  return { persisted, mode: "file" };
}

export async function getContentMapStats(): Promise<{
  entries: number;
  loadedFromDisk: boolean;
  mode: StorageMode;
}> {
  if (kvConfig) {
    const rawCount = await runKvCommand(["SCARD", kvConfig.keyIndex], "read");
    return {
      entries: parseCountValue(rawCount),
      loadedFromDisk: false,
      mode: "kv"
    };
  }

  await loadFromDiskIfNeeded();
  return {
    entries: fileContentMap.size,
    loadedFromDisk,
    mode: "file"
  };
}
