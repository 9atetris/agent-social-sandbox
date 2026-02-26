import { Account, RpcProvider, hash, num } from "starknet";

function parseBoolFromCallResult(result) {
  const first = Array.isArray(result) ? result[0] : result;
  if (typeof first === "boolean") {
    return first;
  }
  if (typeof first === "bigint") {
    return first === 1n;
  }
  if (typeof first === "string") {
    return BigInt(first) === 1n;
  }
  return false;
}

function getTransactionHash(tx) {
  if (!tx || typeof tx !== "object") {
    return "";
  }

  const candidate = tx.transaction_hash ?? tx.transactionHash;
  return typeof candidate === "string" ? candidate : "";
}

export function feltFromText(text) {
  return num.toHex(hash.starknetKeccak(text));
}

export function createStarknetAgentClient(config) {
  const provider = new RpcProvider({ nodeUrl: config.rpcUrl });
  const account = new Account({
    provider,
    address: config.accountAddress,
    signer: config.privateKey
  });

  async function canPost(address = config.accountAddress) {
    const result = await provider.callContract({
      contractAddress: config.agentRegistryAddress,
      entrypoint: "can_post",
      calldata: [address]
    });
    return parseBoolFromCallResult(result);
  }

  async function register(profileUri) {
    const contentUriHash = feltFromText(profileUri);

    if (config.dryRun) {
      return {
        dryRun: true,
        contentUriHash,
        profileUri
      };
    }

    const tx = await account.execute({
      contractAddress: config.agentRegistryAddress,
      entrypoint: "register",
      calldata: [contentUriHash]
    });
    const transactionHash = getTransactionHash(tx);

    if (transactionHash) {
      await provider.waitForTransaction(transactionHash);
    }

    return {
      dryRun: false,
      transactionHash,
      contentUriHash,
      profileUri
    };
  }

  async function createPost({ contentText, parentPostId = 0n }) {
    const contentUriHash = feltFromText(contentText);
    const parent = num.toHex(parentPostId);

    if (config.dryRun) {
      return {
        dryRun: true,
        contentUriHash,
        parentPostId: parent
      };
    }

    const tx = await account.execute({
      contractAddress: config.postHubAddress,
      entrypoint: "create_post",
      calldata: [contentUriHash, parent]
    });
    const transactionHash = getTransactionHash(tx);

    if (transactionHash) {
      await provider.waitForTransaction(transactionHash);
    }

    return {
      dryRun: false,
      transactionHash,
      contentUriHash,
      parentPostId: parent
    };
  }

  async function getPostCount() {
    const result = await provider.callContract({
      contractAddress: config.postHubAddress,
      entrypoint: "post_count",
      calldata: []
    });

    const first = Array.isArray(result) ? result[0] : 0;
    return BigInt(first ?? 0);
  }

  async function vote({ postId, isUp, voteAddress = config.voteAddress }) {
    if (!voteAddress) {
      throw new Error("VOTE_ADDRESS is not configured");
    }

    const normalizedPostId = typeof postId === "bigint" ? postId : BigInt(postId);
    const postIdHex = num.toHex(normalizedPostId);
    const isUpFelt = isUp ? "0x1" : "0x0";

    if (config.dryRun) {
      return {
        dryRun: true,
        voteAddress,
        postId: postIdHex,
        isUp
      };
    }

    const tx = await account.execute({
      contractAddress: voteAddress,
      entrypoint: "vote",
      calldata: [postIdHex, isUpFelt]
    });
    const transactionHash = getTransactionHash(tx);
    if (transactionHash) {
      await provider.waitForTransaction(transactionHash);
    }

    return {
      dryRun: false,
      voteAddress,
      postId: postIdHex,
      isUp,
      transactionHash
    };
  }

  async function getVotes(postId, voteAddress = config.voteAddress) {
    if (!voteAddress) {
      throw new Error("VOTE_ADDRESS is not configured");
    }

    const normalizedPostId = typeof postId === "bigint" ? postId : BigInt(postId);
    const postIdHex = num.toHex(normalizedPostId);
    const result = await provider.callContract({
      contractAddress: voteAddress,
      entrypoint: "get_votes",
      calldata: [postIdHex]
    });

    const up = BigInt(Array.isArray(result) ? (result[0] ?? 0) : 0);
    const down = BigInt(Array.isArray(result) ? (result[1] ?? 0) : 0);
    return { up, down };
  }

  return {
    provider,
    account,
    canPost,
    register,
    createPost,
    getPostCount,
    vote,
    getVotes
  };
}
