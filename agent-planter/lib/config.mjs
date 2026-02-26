import { validateAndParseAddress } from "starknet";

const DEFAULT_FORUM_SYNC_URL = "https://web-green-three-13.vercel.app/api/forum/content-map";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function parseAddressEnv(name) {
  const value = required(name);
  try {
    return validateAndParseAddress(value);
  } catch {
    throw new Error(`Invalid Starknet address in ${name}: ${value}`);
  }
}

function optionalAddressEnv(name, fallback = "") {
  const value = optional(name, fallback);
  if (!value) {
    return "";
  }

  try {
    return validateAndParseAddress(value);
  } catch {
    throw new Error(`Invalid Starknet address in ${name}: ${value}`);
  }
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

function optionalUrl(name, fallback = "") {
  const value = optional(name, fallback);
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    return parsed.toString();
  } catch {
    throw new Error(`Invalid URL for ${name}: ${value}`);
  }
}

export function createRuntimeConfig() {
  const rpcUrl = required("RPC_URL");
  const accountAddress = parseAddressEnv("ACCOUNT_ADDRESS");
  const privateKey = required("PRIVATE_KEY");
  const agentRegistryAddress = parseAddressEnv("AGENT_REGISTRY_ADDRESS");
  const postHubAddress = parseAddressEnv("POST_HUB_ADDRESS");

  return {
    rpcUrl,
    accountAddress,
    privateKey,
    agentRegistryAddress,
    postHubAddress,
    voteAddress: optionalAddressEnv("VOTE_ADDRESS", ""),
    profileUri: optional("AGENT_PROFILE_URI", `agent://${accountAddress}`),
    topic: optional("AGENT_TOPIC", "starknet"),
    tone: optional("AGENT_TONE", "technical"),
    agentName: optional("AGENT_NAME", "@local_agent"),
    parentPostId: parseBigIntEnv("AGENT_PARENT_POST_ID", 0n),
    votePostId: parseBigIntEnv("AGENT_VOTE_POST_ID", 0n),
    voteIsUp: parseBoolEnv("AGENT_VOTE_IS_UP", true),
    maxPosts: parseIntEnv("AGENT_MAX_POSTS", 5),
    postIntervalMs: parseIntEnv("AGENT_POST_INTERVAL_MS", 30_000),
    autoRegisterIfNeeded: parseBoolEnv("AGENT_AUTO_REGISTER", true),
    dryRun: parseBoolEnv("AGENT_DRY_RUN", false),
    forumSyncEnabled: parseBoolEnv("FORUM_SYNC_ENABLED", true),
    forumSyncUrl: optionalUrl("FORUM_SYNC_URL", DEFAULT_FORUM_SYNC_URL),
    forumSyncKey: optional("FORUM_SYNC_KEY", ""),
    openAiApiKey: optional("OPENAI_API_KEY", ""),
    openAiModel: optional("OPENAI_MODEL", "gpt-4o-mini")
  };
}
