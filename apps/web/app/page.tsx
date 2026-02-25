"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Header } from "@/components/Header";
import { PostingEligibilityCard } from "@/components/PostingEligibilityCard";
import { ForumPanel } from "@/components/TimelinePanel";
import type { TimelinePost } from "@/lib/types";

const WalletPanel = dynamic(
  () => import("@/components/WalletPanel").then((module) => module.WalletPanel),
  { ssr: false }
);

type ForumPostsResponse = {
  posts?: TimelinePost[];
  count?: number;
  returned?: number;
  mappedTextCount?: number;
  error?: string;
  message?: string;
};

export default function HomePage() {
  const [forumPosts, setForumPosts] = useState<TimelinePost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [mappedTextCount, setMappedTextCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const loadOnchainPosts = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const response = await fetch("/api/forum/posts?limit=120", {
          method: "GET",
          cache: "no-store"
        });
        const payload = (await response.json()) as ForumPostsResponse;

        if (!response.ok) {
          const message = payload.message ?? payload.error ?? `HTTP ${response.status}`;
          throw new Error(message);
        }

        setForumPosts(Array.isArray(payload.posts) ? payload.posts : []);
        setTotalPosts(typeof payload.count === "number" ? payload.count : 0);
        setMappedTextCount(typeof payload.mappedTextCount === "number" ? payload.mappedTextCount : 0);
        setLastUpdatedAt(new Date().toISOString());
        setErrorMessage(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "failed_to_fetch_forum_posts";
        setErrorMessage(message);
      } finally {
        if (mode === "initial") {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void loadOnchainPosts("initial");
  }, [loadOnchainPosts]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadOnchainPosts("refresh");
    }, 12_000);

    return () => window.clearInterval(id);
  }, [loadOnchainPosts]);

  const statusText = useMemo(() => {
    if (errorMessage) {
      return `Onchain fetch error: ${errorMessage}`;
    }

    if (isLoading) {
      return "Loading onchain forum posts...";
    }

    return `Onchain posts: ${totalPosts} (displaying ${forumPosts.length}, resolved text ${mappedTextCount})`;
  }, [errorMessage, forumPosts.length, isLoading, mappedTextCount, totalPosts]);

  return (
    <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <Header />

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <WalletPanel />
          <PostingEligibilityCard />
        </aside>

        <section>
          <div className="panel-card mb-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Onchain Feed</h2>
                <p className="mt-1 text-sm text-slate-700">{statusText}</p>
                {lastUpdatedAt && <p className="mt-1 text-xs text-slate-500">Last synced: {lastUpdatedAt}</p>}
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-60"
                onClick={() => {
                  void loadOnchainPosts("refresh");
                }}
                disabled={isLoading || isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <ForumPanel
            posts={forumPosts}
            seenPostIds={[]}
            savedTopics={[]}
            mutedTopics={[]}
          />
        </section>
      </div>
    </main>
  );
}
