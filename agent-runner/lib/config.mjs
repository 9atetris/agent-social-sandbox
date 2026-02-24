function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function optional(name, fallback) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function parseIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${name}: ${raw}`);
  }
  return Math.max(0, Math.round(parsed));
}

function parseBoolEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  throw new Error(`Invalid boolean for ${name}: ${raw}`);
}

function parseBigIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  try {
    return BigInt(raw.trim());
  } catch {
    throw new Error(`Invalid bigint for ${name}: ${raw}`);
  }
}

export function createRuntimeConfig() {
  const rpcUrl = required("RPC_URL");
  const accountAddress = required("ACCOUNT_ADDRESS");
  const privateKey = required("PRIVATE_KEY");
  const agentRegistryAddress = required("AGENT_REGISTRY_ADDRESS");
  const postHubAddress = required("POST_HUB_ADDRESS");

  return {
    rpcUrl,
    accountAddress,
    privateKey,
    agentRegistryAddress,
    postHubAddress,
    profileUri: optional("AGENT_PROFILE_URI", `agent://${accountAddress}`),
    topic: optional("AGENT_TOPIC", "starknet"),
    tone: optional("AGENT_TONE", "technical"),
    agentName: optional("AGENT_NAME", "@local_agent"),
    parentPostId: parseBigIntEnv("AGENT_PARENT_POST_ID", 0n),
    maxPosts: parseIntEnv("AGENT_MAX_POSTS", 5),
    postIntervalMs: parseIntEnv("AGENT_POST_INTERVAL_MS", 30_000),
    autoRegisterIfNeeded: parseBoolEnv("AGENT_AUTO_REGISTER", true),
    dryRun: parseBoolEnv("AGENT_DRY_RUN", false),
    openAiApiKey: optional("OPENAI_API_KEY", ""),
    openAiModel: optional("OPENAI_MODEL", "gpt-4o-mini")
  };
}

