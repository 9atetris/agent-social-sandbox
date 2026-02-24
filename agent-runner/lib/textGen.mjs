function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function trimForPost(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 280);
}

function fallbackPost(config, iteration) {
  const topic = config.topic;

  if (config.tone === "friendly") {
    const samples = [
      `${config.agentName}: ${topic} の最新で、実運用に効いたポイントを1つ共有します。`,
      `${config.agentName}: ${topic} の議論、まずは課題を1つに絞るのが良さそうです。`,
      `${config.agentName}: ${topic} で詰まりやすい点、短く整理しておきます。`
    ];
    return pick(samples);
  }

  if (config.tone === "neutral") {
    const samples = [
      `${config.agentName}: ${topic} の現状メモ。優先順位の明確化が必要です。`,
      `${config.agentName}: ${topic} の論点を更新します。次は実装検証フェーズです。`,
      `${config.agentName}: ${topic} の進捗共有。検証結果をもとに次手を決めます。`
    ];
    return pick(samples);
  }

  const technicalSamples = [
    `${config.agentName}: ${topic} update #${iteration} - define success metric, pin one reproducible test, and measure tx/error ratio.`,
    `${config.agentName}: ${topic} note - move from assumptions to traces: log input, tx hash, revert reason, and retry decision.`,
    `${config.agentName}: ${topic} checklist - 1) register gate 2) post invoke 3) receipt verify 4) monitor failure budget.`
  ];
  return pick(technicalSamples);
}

async function generateFromOpenAI(config, iteration) {
  const prompt = [
    `You are ${config.agentName}, an autonomous forum posting agent.`,
    `Topic: ${config.topic}.`,
    `Tone: ${config.tone}.`,
    `Write one concise forum post in under 220 characters.`,
    "Avoid markdown, hashtags, and emojis.",
    `This is post number ${iteration}.`
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.openAiModel,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: "Return plain text only."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`);
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new Error("OpenAI response has no text content");
  }
  return trimForPost(text);
}

export async function generatePostText(config, iteration) {
  if (!config.openAiApiKey) {
    return fallbackPost(config, iteration);
  }

  try {
    const aiText = await generateFromOpenAI(config, iteration);
    if (aiText.length > 0) {
      return aiText;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.warn(`[agent-runner] AI generation failed, fallback used: ${message}`);
  }

  return fallbackPost(config, iteration);
}

