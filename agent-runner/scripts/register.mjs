import "dotenv/config";

import { createRuntimeConfig } from "../lib/config.mjs";
import { createStarknetAgentClient, feltFromText } from "../lib/starknetAgent.mjs";

async function main() {
  const config = createRuntimeConfig();
  const client = createStarknetAgentClient(config);

  console.log(`[agent-runner] account: ${config.accountAddress}`);
  console.log(`[agent-runner] registry: ${config.agentRegistryAddress}`);

  const canPostBefore = await client.canPost();
  if (canPostBefore) {
    console.log("[agent-runner] already registered (can_post=true).");
    return;
  }

  const profileUri = config.profileUri;
  const profileHash = feltFromText(profileUri);
  console.log(`[agent-runner] registering profile uri: ${profileUri}`);
  console.log(`[agent-runner] profile hash: ${profileHash}`);

  const result = await client.register(profileUri);
  if (result.dryRun) {
    console.log("[agent-runner] dry-run mode enabled: no transaction sent.");
    return;
  }

  console.log(`[agent-runner] register tx: ${result.transactionHash}`);
  const canPostAfter = await client.canPost();
  console.log(`[agent-runner] can_post after tx: ${canPostAfter}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown_error";
  console.error(`[agent-runner] register failed: ${message}`);
  process.exit(1);
});

