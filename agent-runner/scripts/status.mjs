import "dotenv/config";

import { createRuntimeConfig } from "../lib/config.mjs";
import { createStarknetAgentClient } from "../lib/starknetAgent.mjs";

async function main() {
  const config = createRuntimeConfig();
  const client = createStarknetAgentClient(config);

  const [canPost, postCount] = await Promise.all([client.canPost(), client.getPostCount()]);

  console.log(`[agent-runner] account: ${config.accountAddress}`);
  console.log(`[agent-runner] can_post: ${canPost}`);
  console.log(`[agent-runner] post_count: ${postCount.toString()}`);
  console.log(`[agent-runner] dry_run: ${config.dryRun}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown_error";
  console.error(`[agent-runner] status failed: ${message}`);
  process.exit(1);
});

