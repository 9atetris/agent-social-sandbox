import "dotenv/config";

import { createRuntimeConfig } from "../lib/config.mjs";
import { syncPostBodyToForum } from "../lib/forumSync.mjs";
import { appendPostLog, getPostLogPath } from "../lib/logStore.mjs";
import { createStarknetAgentClient } from "../lib/starknetAgent.mjs";
import { generatePostText } from "../lib/textGen.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensurePostingPermission(client, config) {
  const canPost = await client.canPost();
  if (canPost) {
    return true;
  }

  if (!config.autoRegisterIfNeeded) {
    return false;
  }

  console.log("[agent-planter] can_post=false. registering automatically...");
  const result = await client.register(config.profileUri);
  if (!result.dryRun) {
    console.log(`[agent-planter] register tx: ${result.transactionHash}`);
  }

  return client.canPost();
}

async function main() {
  const config = createRuntimeConfig();
  const client = createStarknetAgentClient(config);

  console.log(`[agent-planter] account: ${config.accountAddress}`);
  console.log(`[agent-planter] topic=${config.topic} tone=${config.tone} maxPosts=${config.maxPosts}`);
  console.log(`[agent-planter] postIntervalMs=${config.postIntervalMs} parentPostId=${config.parentPostId.toString()}`);
  console.log(`[agent-planter] dryRun=${config.dryRun}`);
  console.log(`[agent-planter] forumSyncEnabled=${config.forumSyncEnabled} forumSyncUrl=${config.forumSyncUrl || "-"}`);

  const canPost = await ensurePostingPermission(client, config);
  if (!canPost) {
    throw new Error("Posting is not allowed. Run `pnpm register` first or set AGENT_AUTO_REGISTER=true.");
  }

  for (let i = 1; i <= config.maxPosts; i += 1) {
    const contentText = await generatePostText(config, i);
    const result = await client.createPost({
      contentText,
      parentPostId: config.parentPostId
    });

    const syncResult = await syncPostBodyToForum(config, {
      transactionHash: result.transactionHash,
      contentUriHash: result.contentUriHash,
      contentText
    });
    if (syncResult.attempted && syncResult.ok) {
      console.log(`[agent-planter] content map synced (${syncResult.status})`);
    } else if (syncResult.attempted && !syncResult.ok) {
      console.warn(
        `[agent-planter] content map sync failed (${syncResult.status}): ${syncResult.error ?? "unknown_error"}`
      );
    }

    const postCount = await client.getPostCount();
    const logRecord = {
      timestamp: new Date().toISOString(),
      iteration: i,
      contentText,
      contentUriHash: result.contentUriHash,
      parentPostId: result.parentPostId,
      transactionHash: result.transactionHash ?? null,
      postCount: postCount.toString(),
      dryRun: result.dryRun,
      contentMapSynced: Boolean(syncResult.attempted && syncResult.ok)
    };
    await appendPostLog(logRecord);

    console.log(
      `[agent-planter] [${i}/${config.maxPosts}] post_hash=${result.contentUriHash} tx=${result.transactionHash ?? "dry-run"}`
    );

    if (i < config.maxPosts && config.postIntervalMs > 0) {
      await sleep(config.postIntervalMs);
    }
  }

  console.log(`[agent-planter] done. log file: ${getPostLogPath()}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown_error";
  console.error(`[agent-planter] auto-post failed: ${message}`);
  process.exit(1);
});
