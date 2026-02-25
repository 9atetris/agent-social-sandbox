import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getContentTextsByHashes } from "@/lib/contentMapStore";
import type { TimelinePost } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 80;
const MAX_LIMIT = 300;
const ENTRYPOINT_SELECTOR_POST_COUNT = "0x10b282a55c555c7ac392567f3ecd9214fc52f47150bc304011c8517743f0104";
const ENTRYPOINT_SELECTOR_GET_POST = "0x28beeeff0981aa3f68765d8ffd49a37cd542dda0e4524780b4f20f7fef93f1e";

type LocalPostLogRecord = {
  contentUriHash?: string;
  contentText?: string;
};

function parseLimit(input: string | null): number {
  if (!input) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.round(parsed)));
}

function parseHexOrDecToBigInt(input: unknown): bigint {
  const zero = BigInt(0);

  if (typeof input === "bigint") {
    return input;
  }

  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      return zero;
    }
    return BigInt(Math.max(0, Math.floor(input)));
  }

  if (typeof input === "string") {
    const normalized = input.trim();
    if (!normalized) {
      return zero;
    }

    try {
      return BigInt(normalized);
    } catch {
      return zero;
    }
  }

  return zero;
}

function normalizeHashKey(input: string): string {
  return input.trim().toLowerCase();
}

function safeIsoFromUnixSeconds(input: bigint): string {
  const asNumber = Number(input);
  if (!Number.isFinite(asNumber)) {
    return new Date(0).toISOString();
  }

  const date = new Date(asNumber * 1000);
  if (Number.isNaN(date.getTime())) {
    return new Date(0).toISOString();
  }

  return date.toISOString();
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function resolveRpcUrl(): string | undefined {
  const envUrl = process.env.NEXT_PUBLIC_RPC_URL;
  if (envUrl && envUrl.length > 0) {
    return envUrl;
  }

  return undefined;
}

function resolvePostHubAddress(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_POST_HUB_ADDRESS?.trim();
  if (!raw) {
    return undefined;
  }

  if (!raw.startsWith("0x") || raw.length < 4) {
    return undefined;
  }

  const isHex = /^[0-9a-fA-Fx]+$/.test(raw);
  if (!isHex) {
    return undefined;
  }

  return raw;
}

function readFeltArrayValue(values: string[], index: number): string {
  return values[index] ?? "0x0";
}

function readBigIntArrayValue(values: string[], index: number): bigint {
  return parseHexOrDecToBigInt(values[index] ?? "0");
}

async function loadLocalContentMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const runnerLogPath = path.resolve(process.cwd(), "../../agent-runner/data/posts.ndjson");

  let text: string;
  try {
    text = await readFile(runnerLogPath, "utf8");
  } catch {
    return map;
  }

  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  for (const line of lines) {
    try {
      const row = JSON.parse(line) as LocalPostLogRecord;
      if (typeof row.contentUriHash === "string" && typeof row.contentText === "string" && row.contentText.trim().length > 0) {
        map.set(normalizeHashKey(row.contentUriHash), row.contentText.trim());
      }
    } catch {
      continue;
    }
  }

  return map;
}

function hexFromBigInt(value: bigint): string {
  const normalized = value >= BigInt(0) ? value : BigInt(0);
  return `0x${normalized.toString(16)}`;
}

async function rpcCall(rpcUrl: string, params: { contractAddress: string; selector: string; calldata: string[] }) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "starknet_call",
      params: {
        request: {
          contract_address: params.contractAddress,
          entry_point_selector: params.selector,
          calldata: params.calldata
        },
        block_id: "latest"
      }
    }),
    cache: "no-store"
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`rpc_invalid_json_response (${response.status}): ${text.slice(0, 160)}`);
  }

  if (!response.ok) {
    throw new Error(`rpc_http_error_${response.status}: ${JSON.stringify(payload).slice(0, 240)}`);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("rpc_invalid_payload");
  }

  const asRecord = payload as Record<string, unknown>;
  if ("error" in asRecord) {
    throw new Error(`rpc_call_error: ${JSON.stringify(asRecord.error).slice(0, 240)}`);
  }

  const result = asRecord.result;
  if (!Array.isArray(result)) {
    throw new Error(`rpc_invalid_result: ${JSON.stringify(result).slice(0, 240)}`);
  }

  return result.map((item) => String(item));
}

async function fetchPostCount(rpcUrl: string, postHubAddress: string): Promise<bigint> {
  const values = await rpcCall(rpcUrl, {
    contractAddress: postHubAddress,
    selector: ENTRYPOINT_SELECTOR_POST_COUNT,
    calldata: []
  });

  return readBigIntArrayValue(values, 0);
}

async function fetchPost(rpcUrl: string, postHubAddress: string, postId: bigint): Promise<{
  author: string;
  contentUriHash: string;
  parentPostId: bigint;
  createdAtUnixSeconds: bigint;
}> {
  const values = await rpcCall(rpcUrl, {
    contractAddress: postHubAddress,
    selector: ENTRYPOINT_SELECTOR_GET_POST,
    calldata: [hexFromBigInt(postId)]
  });

  return {
    author: readFeltArrayValue(values, 0),
    contentUriHash: readFeltArrayValue(values, 1),
    parentPostId: readBigIntArrayValue(values, 2),
    createdAtUnixSeconds: readBigIntArrayValue(values, 3)
  };
}

function toTimelinePost(args: {
  postId: bigint;
  author: string;
  contentUriHash: string;
  parentPostId: bigint;
  createdAtUnixSeconds: bigint;
  localContentMap: Map<string, string>;
}): TimelinePost {
  const normalizedHash = normalizeHashKey(args.contentUriHash);
  const mappedText = args.localContentMap.get(normalizedHash);

  return {
    id: `onchain-${args.postId.toString()}`,
    postId: args.postId.toString(),
    author: shortenAddress(args.author),
    text: mappedText ?? `content_uri_hash: ${args.contentUriHash}`,
    topic: "starknet",
    sentiment: "neutral",
    engagementScore: 50,
    createdAt: safeIsoFromUnixSeconds(args.createdAtUnixSeconds),
    replyToPostId: args.parentPostId > BigInt(0) ? `onchain-${args.parentPostId.toString()}` : undefined,
    contentUriHash: args.contentUriHash,
    hasOffchainText: Boolean(mappedText)
  };
}

export async function GET(request: Request) {
  const rpcUrl = resolveRpcUrl();
  if (!rpcUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_RPC_URL is not configured" }, { status: 503 });
  }

  const postHubAddress = resolvePostHubAddress();
  if (!postHubAddress) {
    return NextResponse.json({ error: "NEXT_PUBLIC_POST_HUB_ADDRESS is not configured or invalid" }, { status: 503 });
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));

  try {
    const [runnerContentMap, postCount] = await Promise.all([loadLocalContentMap(), fetchPostCount(rpcUrl, postHubAddress)]);

    if (postCount <= BigInt(0)) {
      return NextResponse.json({
        posts: [],
        count: 0,
        returned: 0,
        mappedTextCount: 0
      });
    }

    const newest = postCount;
    const candidateOldest = newest - BigInt(limit) + BigInt(1);
    const oldest = candidateOldest > BigInt(1) ? candidateOldest : BigInt(1);
    const ids: bigint[] = [];
    for (let id = newest; id >= oldest; id -= BigInt(1)) {
      ids.push(id);
    }

    const rawPosts = await Promise.all(ids.map((id) => fetchPost(rpcUrl, postHubAddress, id)));
    const contentHashes = Array.from(new Set(rawPosts.map((post) => normalizeHashKey(post.contentUriHash))));
    const storedContentMap = await getContentTextsByHashes(contentHashes);
    const mergedContentMap = new Map(storedContentMap);
    for (const [hash, text] of runnerContentMap.entries()) {
      mergedContentMap.set(hash, text);
    }

    const posts = rawPosts.map((post, index) =>
      toTimelinePost({
        postId: ids[index],
        author: post.author,
        contentUriHash: post.contentUriHash,
        parentPostId: post.parentPostId,
        createdAtUnixSeconds: post.createdAtUnixSeconds,
        localContentMap: mergedContentMap
      })
    );

    const mappedTextCount = posts.filter((post) => post.hasOffchainText).length;

    return NextResponse.json({
      posts,
      count: Number(postCount),
      returned: posts.length,
      mappedTextCount
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      {
        error: "failed_to_fetch_onchain_posts",
        message
      },
      { status: 500 }
    );
  }
}
