export type Goal = "discover" | "engage" | "broadcast";
export type Tone = "neutral" | "friendly" | "technical";
export type RiskTolerance = "low" | "medium" | "high";
export type PlannerMode = "rule" | "ai";
export type PlannerSource = "rule" | "ai" | "rule_fallback";
export type RunStatus = "idle" | "running" | "stopped" | "finished" | "error";

export type RiskLevel = "safe" | "medium" | "high";

export type StopReason =
  | "manual_stop"
  | "max_actions_reached"
  | "toxicity_risk_high"
  | "low_confidence"
  | "duplicate_content_detected"
  | "rate_limit_risk"
  | "no_relevant_posts"
  | "consecutive_failures";

export type TimelinePost = {
  id: string;
  author: string;
  text: string;
  topic: "starknet" | "ai" | "event" | "gaming" | "general" | string;
  sentiment: "positive" | "neutral" | "negative";
  engagementScore: number;
  createdAt: string;
  replyToPostId?: string;
  postId?: string;
  contentUriHash?: string;
  hasOffchainText?: boolean;
};

export type SocialPolicy = {
  goal: Goal;
  tone: Tone;
  riskTolerance: RiskTolerance;
  plannerMode: PlannerMode;
  maxAutoActions: number;
};

export type AgentActionType =
  | "draft_post"
  | "draft_reply"
  | "bookmark_thread"
  | "follow_topic"
  | "mute_topic"
  | "ask_user_approval"
  | "skip";

export type AgentAction = {
  type: AgentActionType;
  targetPostId?: string;
  payload?: {
    draftText?: string;
    topic?: string;
  };
  reason: string;
  expectedOutcome: string;
};

export type AgentCycleOutput = {
  observe: string;
  plan: string;
  action: AgentAction;
  resultPreview: string;
  risk: RiskLevel;
  confidence: number;
};

export type ActionLog = {
  step: number;
  observe: string;
  plan: string;
  action: AgentAction;
  result: string;
  risk: RiskLevel;
  confidence: number;
  success: boolean;
  plannerSource?: PlannerSource;
  latencyMs?: number;
  stopTriggered?: StopReason;
};

export type DraftItem = {
  id: string;
  kind: "post" | "reply";
  text: string;
  targetPostId?: string;
};

export type ArenaAgent = {
  id: string;
  name: string;
  goal: Goal;
  tone: Tone;
  topic: string;
  cadenceSeconds: number;
  enabled: boolean;
  createdAt: string;
};

export type ArenaMessage = {
  id: string;
  agentId: string;
  agentName: string;
  text: string;
  topic: string;
  sentiment: "positive" | "neutral" | "negative";
  engagementScore: number;
  createdAt: string;
  replyToMessageId?: string;
};

export type SocialAgentState = {
  runId: string;
  status: RunStatus;
  step: number;
  policy: SocialPolicy;
  timeline: TimelinePost[];
  seenPostIds: string[];
  savedTopics: string[];
  mutedTopics: string[];
  draftQueue: DraftItem[];
  logs: ActionLog[];
  consecutiveFailures: number;
  endReason?: StopReason;
};

export const STOP_CONDITIONS: StopReason[] = [
  "manual_stop",
  "max_actions_reached",
  "toxicity_risk_high",
  "low_confidence",
  "duplicate_content_detected",
  "rate_limit_risk",
  "no_relevant_posts",
  "consecutive_failures"
];

export const MAX_CONSECUTIVE_FAILURES = 3;
