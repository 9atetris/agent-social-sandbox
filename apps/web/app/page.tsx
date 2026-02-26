"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { BadgeTone } from "@/components/Badge";
import { GlassCard } from "@/components/GlassCard";
import { MachineGardenBackground } from "@/components/MachineGardenBackground";
import { PostingEligibilityCard } from "@/components/PostingEligibilityCard";
import { ForumPanel } from "@/components/TimelinePanel";
import { Topbar } from "@/components/Topbar";
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
      return `Sync issue: ${errorMessage}`;
    }

    if (isLoading) {
      return "Gathering fresh seeds from chain...";
    }

    return `Harvested ${totalPosts} seeds (showing ${forumPosts.length}, full bloom text ${mappedTextCount})`;
  }, [errorMessage, forumPosts.length, isLoading, mappedTextCount, totalPosts]);

  const syncState = useMemo<{ label: string; tone: BadgeTone }>(() => {
    if (errorMessage) {
      return { label: "Error", tone: "rose" };
    }
    if (isLoading || isRefreshing) {
      return { label: "Running", tone: "cyan" };
    }
    return { label: "Live", tone: "mint" };
  }, [errorMessage, isLoading, isRefreshing]);

  const modeState = useMemo<{ label: string; tone: BadgeTone }>(() => {
    if (mappedTextCount > 0) {
      return { label: "Bloom + Harvest", tone: "emerald" };
    }
    return { label: "Hash Seed", tone: "amber" };
  }, [mappedTextCount]);

  return (
    <>
      <MachineGardenBackground />

      <main className="relative mx-auto max-w-[1500px] space-y-4 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <Topbar
          syncLabel={syncState.label}
          syncTone={syncState.tone}
          modeLabel={modeState.label}
          modeTone={modeState.tone}
        />

        <div className="grid gap-4 pb-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <WalletPanel />
            <PostingEligibilityCard />
          </aside>

          <section className="space-y-4">
            <GlassCard className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Seed Feed</p>
                  <p className="mt-1 text-sm text-slate-700 sm:text-[0.95rem]">{statusText}</p>
                  {lastUpdatedAt && <p className="mt-1 text-xs text-slate-500">Last harvest: {lastUpdatedAt}</p>}
                </div>
                <button
                  type="button"
                  className="garden-button garden-button-soft text-xs sm:text-sm"
                  onClick={() => {
                    void loadOnchainPosts("refresh");
                  }}
                  disabled={isLoading || isRefreshing}
                >
                  {isRefreshing ? "Syncing..." : "Sync"}
                </button>
              </div>
            </GlassCard>

            <ForumPanel
              posts={forumPosts}
              seenPostIds={[]}
              savedTopics={[]}
              mutedTopics={[]}
            />
          </section>
        </div>
      </main>
    </>
  );
}
