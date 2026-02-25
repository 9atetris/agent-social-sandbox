import { NextResponse } from "next/server";

import { getContentMapStats, upsertContentMapEntry } from "@/lib/contentMapStore";
import { enforceRateLimit } from "@/lib/serverRateLimit";

type ContentMapPayload = {
  contentUriHash?: string;
  contentText?: string;
};

const CONTENT_MAP_RATE_LIMIT_WINDOW_MS = Number(process.env.AGENT_CONTENT_MAP_RATE_LIMIT_WINDOW_MS ?? 60_000);
const CONTENT_MAP_RATE_LIMIT_MAX = Number(process.env.AGENT_CONTENT_MAP_RATE_LIMIT_MAX ?? 60);

function parseAuthHeader(request: Request): string | undefined {
  const direct = request.headers.get("x-agent-key")?.trim();
  if (direct) {
    return direct;
  }

  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) {
    return undefined;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function ensureAuthorized(request: Request): NextResponse | undefined {
  const expectedKey = process.env.AGENT_CONTENT_MAP_KEY ?? process.env.AGENT_BRIDGE_KEY;
  if (!expectedKey) {
    return NextResponse.json(
      {
        error: "AGENT_CONTENT_MAP_KEY or AGENT_BRIDGE_KEY is not configured"
      },
      { status: 503 }
    );
  }

  const provided = parseAuthHeader(request);
  if (!provided || provided !== expectedKey) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return undefined;
}

function isHexHash(input: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(input.trim());
}

export async function GET() {
  const stats = await getContentMapStats();

  return NextResponse.json({
    entries: stats.entries,
    loadedFromDisk: stats.loadedFromDisk
  });
}

export async function POST(request: Request) {
  const limited = enforceRateLimit({
    request,
    bucket: "forum_content_map_post",
    maxRequests: CONTENT_MAP_RATE_LIMIT_MAX,
    windowMs: CONTENT_MAP_RATE_LIMIT_WINDOW_MS
  });
  if (limited.limited) {
    return limited.response;
  }

  const authError = ensureAuthorized(request);
  if (authError) {
    return authError;
  }

  let payload: ContentMapPayload;
  try {
    payload = (await request.json()) as ContentMapPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const contentUriHash = payload.contentUriHash?.trim() ?? "";
  const contentText = payload.contentText?.trim() ?? "";

  if (!isHexHash(contentUriHash)) {
    return NextResponse.json({ error: "contentUriHash must be 0x-prefixed hex" }, { status: 400 });
  }

  if (contentText.length === 0) {
    return NextResponse.json({ error: "contentText is required" }, { status: 400 });
  }

  const result = await upsertContentMapEntry({
    contentUriHash,
    contentText
  });
  const stats = await getContentMapStats();

  return NextResponse.json({
    accepted: true,
    persisted: result.persisted,
    entries: stats.entries
  });
}

