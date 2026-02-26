import "dotenv/config";

import { createRuntimeConfig } from "../lib/config.mjs";
import { createStarknetAgentClient } from "../lib/starknetAgent.mjs";

function printUsage() {
  console.log("Usage:");
  console.log("  pnpm vote -- --post-id <id> [--up|--down]");
  console.log("");
  console.log("Optional env defaults:");
  console.log("  AGENT_VOTE_POST_ID=<id>");
  console.log("  AGENT_VOTE_IS_UP=true|false");
}

function parseArgs(argv) {
  let postId;
  let direction;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      continue;
    }
    if (arg === "--post-id") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --post-id");
      }
      try {
        postId = BigInt(value);
      } catch {
        throw new Error(`Invalid --post-id value: ${value}`);
      }
      i += 1;
      continue;
    }

    if (arg === "--up") {
      direction = true;
      continue;
    }

    if (arg === "--down") {
      direction = false;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { postId, direction };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }

  const config = createRuntimeConfig();
  if (!config.voteAddress) {
    throw new Error("Missing VOTE_ADDRESS in .env");
  }

  const client = createStarknetAgentClient(config);
  const parsed = parseArgs(argv);

  const postId = parsed.postId ?? config.votePostId;
  if (postId <= 0n) {
    throw new Error("post_id must be >= 1. Pass --post-id or set AGENT_VOTE_POST_ID.");
  }

  const isUp = typeof parsed.direction === "boolean" ? parsed.direction : config.voteIsUp;
  const directionLabel = isUp ? "upvote" : "downvote";

  console.log(`[agent-planter] account: ${config.accountAddress}`);
  console.log(`[agent-planter] vote_contract: ${config.voteAddress}`);
  console.log(`[agent-planter] post_id: ${postId.toString()} (${directionLabel})`);
  console.log(`[agent-planter] dry_run: ${config.dryRun}`);

  const canPost = await client.canPost();
  if (!canPost) {
    throw new Error("Account is not registered in AgentRegistry (can_post=false).");
  }

  const result = await client.vote({
    postId,
    isUp,
    voteAddress: config.voteAddress
  });

  if (result.dryRun) {
    console.log("[agent-planter] dry-run mode enabled: no transaction sent.");
    return;
  }

  console.log(`[agent-planter] vote tx: ${result.transactionHash}`);

  const counts = await client.getVotes(postId, config.voteAddress);
  console.log(`[agent-planter] votes: up=${counts.up.toString()} down=${counts.down.toString()}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown_error";
  console.error(`[agent-planter] vote failed: ${message}`);
  process.exit(1);
});
