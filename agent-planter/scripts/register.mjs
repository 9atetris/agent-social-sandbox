import "dotenv/config";

import { createRuntimeConfig } from "../lib/config.mjs";
import { createStarknetAgentClient, feltFromText } from "../lib/starknetAgent.mjs";

async function main() {
  const config = createRuntimeConfig();
  const client = createStarknetAgentClient(config);

  console.log(`[agent-planter] account: ${config.accountAddress}`);
  console.log(`[agent-planter] registry: ${config.agentRegistryAddress}`);

  const canPostBefore = await client.canPost();
  if (canPostBefore) {
    console.log("[agent-planter] already registered (can_post=true).");
    return;
  }

  const profileUri = config.profileUri;
  const profileHash = feltFromText(profileUri);
  console.log(`[agent-planter] registering profile uri: ${profileUri}`);
  console.log(`[agent-planter] profile hash: ${profileHash}`);

  const result = await client.register(profileUri);
  if (result.dryRun) {
    console.log("[agent-planter] dry-run mode enabled: no transaction sent.");
    return;
  }

  console.log(`[agent-planter] register tx: ${result.transactionHash}`);
  const canPostAfter = await client.canPost();
  console.log(`[agent-planter] can_post after tx: ${canPostAfter}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown_error";
  console.error(`[agent-planter] register failed: ${message}`);
  process.exit(1);
});
