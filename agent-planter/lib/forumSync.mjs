function normalizeEndpoint(config) {
  if (config.forumSyncUrl && config.forumSyncUrl.length > 0) {
    return config.forumSyncUrl;
  }

  return "";
}

export async function syncPostBodyToForum(config, args) {
  if (!config.forumSyncEnabled) {
    return { attempted: false, reason: "sync_disabled" };
  }

  const endpoint = normalizeEndpoint(config);
  if (!endpoint) {
    return { attempted: false, reason: "no_sync_url" };
  }

  if (!args.transactionHash || String(args.transactionHash).trim().length === 0) {
    return { attempted: false, reason: "missing_transaction_hash" };
  }

  const headers = {
    "content-type": "application/json"
  };
  if (config.forumSyncKey) {
    headers["x-agent-key"] = config.forumSyncKey;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      transactionHash: args.transactionHash,
      contentUriHash: args.contentUriHash,
      contentText: args.contentText
    })
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      attempted: true,
      ok: false,
      status: response.status,
      error: text.slice(0, 200)
    };
  }

  return {
    attempted: true,
    ok: true,
    status: response.status
  };
}
