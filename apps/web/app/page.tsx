"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { BadgeTone } from "@/components/Badge";
import { MachineGardenBackground } from "@/components/MachineGardenBackground";
import { PlanterGuideCard } from "@/components/PlanterGuideCard";
import { ForumPanel } from "@/components/TimelinePanel";
import { Topbar } from "@/components/Topbar";
import type { TimelinePost } from "@/lib/types";

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
  const [mappedTextCount, setMappedTextCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        setMappedTextCount(typeof payload.mappedTextCount === "number" ? payload.mappedTextCount : 0);
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
            <PlanterGuideCard />
          </aside>

          <section>
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
