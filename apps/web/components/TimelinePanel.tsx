"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/Badge";
import { GlassCard } from "@/components/GlassCard";
import type { TimelinePost } from "@/lib/types";
import { formatUtcDateTime } from "@/lib/utils";

type ForumPanelProps = {
  posts: TimelinePost[];
  seenPostIds: string[];
  savedTopics: string[];
  mutedTopics: string[];
};

const AUTO_COLLAPSE_REPLY_THRESHOLD = 8;

function sentimentTone(sentiment: TimelinePost["sentiment"]): "emerald" | "rose" | "slate" {
  if (sentiment === "positive") {
    return "emerald";
  }

  if (sentiment === "negative") {
    return "rose";
  }

  return "slate";
}

function byNewest(a: TimelinePost, b: TimelinePost): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

function byOldest(a: TimelinePost, b: TimelinePost): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

function clampThreadIndent(depth: number): number {
  return Math.max(0, Math.min(4, depth));
}

function shortHash(input: string): string {
  if (input.length <= 18) {
    return input;
  }

  return `${input.slice(0, 10)}...${input.slice(-6)}`;
}

function buildForumData(posts: TimelinePost[]) {
  const byId = new Map(posts.map((post) => [post.id, post]));
  const repliesByParentId = new Map<string, TimelinePost[]>();
  const roots: TimelinePost[] = [];

  for (const post of posts) {
    if (post.replyToPostId && byId.has(post.replyToPostId)) {
      const bucket = repliesByParentId.get(post.replyToPostId) ?? [];
      bucket.push(post);
      repliesByParentId.set(post.replyToPostId, bucket);
      continue;
    }

    roots.push(post);
  }

  for (const [parentId, replies] of repliesByParentId.entries()) {
    repliesByParentId.set(parentId, [...replies].sort(byOldest));
  }

  return {
    roots: [...roots].sort(byNewest),
    repliesByParentId
  };
}

function countReplies(postId: string, repliesByParentId: Map<string, TimelinePost[]>): number {
  return countRepliesWithGuard(postId, repliesByParentId, new Set<string>());
}

function countRepliesWithGuard(
  postId: string,
  repliesByParentId: Map<string, TimelinePost[]>,
  visited: Set<string>
): number {
  if (visited.has(postId)) {
    return 0;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(postId);
  const directReplies = repliesByParentId.get(postId) ?? [];
  if (directReplies.length === 0) {
    return 0;
  }

  return directReplies.reduce((total, reply) => total + 1 + countRepliesWithGuard(reply.id, repliesByParentId, nextVisited), 0);
}

function forumBadges(post: TimelinePost, args: { seenPostIds: string[]; savedTopics: string[]; mutedTopics: string[] }) {
  const seen = args.seenPostIds.includes(post.id);
  const tracked = args.savedTopics.includes(post.topic);
  const muted = args.mutedTopics.includes(post.topic);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <Badge tone={sentimentTone(post.sentiment)}>{post.sentiment}</Badge>
      <Badge tone="cyan">{post.topic}</Badge>
      <Badge tone="slate">score {post.engagementScore}</Badge>
      {tracked && <Badge tone="mint">tracked</Badge>}
      {muted && <Badge tone="amber">muted</Badge>}
      {seen && <Badge tone="slate">seen</Badge>}
      {post.postId && <Badge tone="cyan">seed #{post.postId}</Badge>}
      {post.contentUriHash && (
        <Badge tone="slate" className="font-mono">
          hash {shortHash(post.contentUriHash)}
        </Badge>
      )}
      {post.hasOffchainText === true && <Badge tone="emerald">harvested text</Badge>}
      {post.hasOffchainText === false && (
        <Badge tone="amber">hash only</Badge>
      )}
    </div>
  );
}

function renderReplies(args: {
  parentId: string;
  repliesByParentId: Map<string, TimelinePost[]>;
  seenPostIds: string[];
  savedTopics: string[];
  mutedTopics: string[];
  depth: number;
  path: Set<string>;
}) {
  if (args.path.has(args.parentId)) {
    return null;
  }

  const replies = args.repliesByParentId.get(args.parentId) ?? [];
  if (replies.length === 0) {
    return null;
  }

  const nextPath = new Set(args.path);
  nextPath.add(args.parentId);
  const indent = clampThreadIndent(args.depth) * 12;

  return (
    <ul className="mt-3 space-y-2 border-l border-slate-300/60 pl-3" style={{ marginLeft: `${indent}px` }}>
      {replies.map((reply) => (
        <li key={reply.id} className="rounded-lg border border-slate-200/70 bg-white/72 p-3 shadow-sm shadow-slate-800/5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs font-semibold text-slate-900">{reply.author}</span>
            <span className="font-mono text-[11px] text-slate-500">{formatUtcDateTime(reply.createdAt)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{reply.text}</p>
          {forumBadges(reply, args)}
          {renderReplies({
            parentId: reply.id,
            repliesByParentId: args.repliesByParentId,
            seenPostIds: args.seenPostIds,
            savedTopics: args.savedTopics,
            mutedTopics: args.mutedTopics,
            depth: args.depth + 1,
            path: nextPath
          })}
        </li>
      ))}
    </ul>
  );
}

export function ForumPanel({ posts, seenPostIds, savedTopics, mutedTopics }: ForumPanelProps) {
  const [expandedByThreadId, setExpandedByThreadId] = useState<Record<string, boolean>>({});
  const { roots, repliesByParentId } = useMemo(() => buildForumData(posts), [posts]);

  const toggleThread = (threadId: string, currentlyExpanded: boolean) => {
    setExpandedByThreadId((prev) => ({
      ...prev,
      [threadId]: !currentlyExpanded
    }));
  };

  return (
    <GlassCard className="animate-fadeInUp p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Seed Threads</h2>
        <p className="text-xs text-slate-500">{roots.length} beds</p>
      </div>

      {roots.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white/72 p-3 text-sm text-slate-600">
          No seeds yet. Plant a seed through onchain `PostHub.create_post`.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {roots.map((root) => {
            const replyCount = countReplies(root.id, repliesByParentId);
            const expanded = expandedByThreadId[root.id] ?? replyCount < AUTO_COLLAPSE_REPLY_THRESHOLD;
            const showCollapseControl = replyCount >= AUTO_COLLAPSE_REPLY_THRESHOLD;

            return (
              <li key={root.id} className="rounded-xl border border-slate-200/70 bg-white/76 p-4 shadow-sm shadow-slate-900/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">seed</span>
                  <span className="font-mono text-[11px] text-slate-500">{formatUtcDateTime(root.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-base font-semibold text-slate-900">{root.text}</p>
                <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-slate-700">
                  <span className="min-w-0 truncate font-medium">{root.author}</span>
                  <span className="text-slate-400">•</span>
                  <span>{replyCount} blooms</span>
                </div>
                {forumBadges(root, { seenPostIds, savedTopics, mutedTopics })}

                {showCollapseControl && (
                  <button
                    type="button"
                    className="garden-button garden-button-soft mt-3 px-3 py-1 text-xs"
                    onClick={() => toggleThread(root.id, expanded)}
                  >
                    {expanded ? `Fold blooms (${replyCount})` : `Show blooms (${replyCount})`}
                  </button>
                )}

                {expanded ? (
                  renderReplies({
                    parentId: root.id,
                    repliesByParentId,
                    seenPostIds,
                    savedTopics,
                    mutedTopics,
                    depth: 1,
                    path: new Set<string>()
                  })
                ) : (
                  <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
                    Seed folded. Click “Show blooms” to expand.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
