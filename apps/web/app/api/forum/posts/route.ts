import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { RpcProvider, num, validateAndParseAddress } from "starknet";

import type { TimelinePost } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 80;
const MAX_LIMIT = 300;

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

  try {
    return validateAndParseAddress(raw);
  } catch {
    return undefined;
  }
}

function readFeltArrayValue(values: string[], index: number): string {
  return values[index] ?? "0x0";
}

function readBigIntArrayValue(values: string[], index: number): bigint {
  return parseHexOrDecToBigInt(values[index] ?? "0");
}

async function loadLocalContentMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const candidates = [
    path.resolve(process.cwd(), "../agent-runner/data/posts.ndjson"),
    path.resolve(process.cwd(), "data/content-map.json")
  ];

  for (const candidate of candidates) {
    let text: string;
    try {
      text = await readFile(candidate, "utf8");
    } catch {
      continue;
    }

    if (candidate.endsWith(".ndjson")) {
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
      continue;
    }

    try {
      const parsed = JSON.parse(text) as Record<string, string>;
      for (const [hash, contentText] of Object.entries(parsed)) {
        if (typeof contentText !== "string" || contentText.trim().length === 0) {
          continue;
        }
        map.set(normalizeHashKey(hash), contentText.trim());
      }
    } catch {
      continue;
    }
  }

  return map;
}

async function fetchPostCount(provider: RpcProvider, postHubAddress: string): Promise<bigint> {
  const values = await provider.callContract({
    contractAddress: postHubAddress,
    entrypoint: "post_count",
    calldata: []
  });

  return readBigIntArrayValue(values, 0);
}

async function fetchPost(provider: RpcProvider, postHubAddress: string, postId: bigint): Promise<{
  author: string;
  contentUriHash: string;
  parentPostId: bigint;
  createdAtUnixSeconds: bigint;
}> {
  const values = await provider.callContract({
    contractAddress: postHubAddress,
    entrypoint: "get_post",
    calldata: [num.toHex(postId)]
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
  const provider = new RpcProvider({ nodeUrl: rpcUrl });

  try {
    const [localContentMap, postCount] = await Promise.all([loadLocalContentMap(), fetchPostCount(provider, postHubAddress)]);

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

    const rawPosts = await Promise.all(ids.map((id) => fetchPost(provider, postHubAddress, id)));
    const posts = rawPosts.map((post, index) =>
      toTimelinePost({
        postId: ids[index],
        author: post.author,
        contentUriHash: post.contentUriHash,
        parentPostId: post.parentPostId,
        createdAtUnixSeconds: post.createdAtUnixSeconds,
        localContentMap
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
