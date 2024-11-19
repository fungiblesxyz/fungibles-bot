import { parseAbiItem, formatUnits } from "viem";
import {
  sendMediaToChat,
  sendMessageToChat,
  sendLogToChannel,
} from "../helpers/bot";
import {
  shortenAddress,
  convertToPositive,
  _n,
  getEthUsdPrice,
  getTokenHoldersCount,
  fetchChats,
} from "../helpers/utils";
import client from "../client";
import { ChatResponse, ChatEntry } from "../types";

const UNISWAP_V3_POOL_ABI = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"
);

const ERC20_BALANCE_ABI = parseAbiItem(
  "function balanceOf(address) view returns (uint256)"
);

let chats: ChatResponse;

export async function updateChats() {
  try {
    chats = await fetchChats();
  } catch (error) {
    console.error("Failed to update chats:", error);
    sendLogToChannel(`Failed to update chats: ${error}`);
    // Use previous chats data if available
    if (!chats) {
      chats = {};
    }
  }
}

export async function monitorBuys() {
  await updateChats();
  chats = Object.entries(chats)
    .filter(([_, chat]) => chat?.info?.id)
    .reduce(
      (acc, [key, chat]) => ({
        ...acc,
        [key]: chat,
      }),
      {}
    ) as ChatResponse;

  let ethUsdPrice: number;
  let holdersCounts: Record<string, number>;

  try {
    [ethUsdPrice, holdersCounts] = await Promise.all([
      getEthUsdPrice(client),
      getTokenHoldersCount(chats, client),
    ]);

    if (ethUsdPrice === 0) {
      throw new Error("Failed to fetch ETH price");
    }
  } catch (error) {
    console.error("Failed to fetch critical data:", error);
    sendLogToChannel(`Failed to fetch critical data: ${error}`);
    return; // Exit monitoring if we can't get critical data
  }

  const v3Pools = Object.values(chats)
    .map((chat) => chat.pools?.UniswapV3)
    .filter((address): address is string => !!address);

  const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
  const poolTokens = await Promise.all(
    v3Pools.map(async (pool) => ({
      pool,
      isWethToken0:
        (
          await client.readContract({
            address: pool as `0x${string}`,
            abi: [parseAbiItem("function token0() view returns (address)")],
            functionName: "token0",
          })
        ).toLowerCase() === WETH_ADDRESS.toLowerCase(),
    }))
  );
  if (!poolTokens.length) return;

  client.watchContractEvent({
    address: v3Pools as `0x${string}`[],
    abi: [UNISWAP_V3_POOL_ABI],
    pollingInterval: 5000,
    fromBlock: process.env.BUYS_FROM_BLOCK_NUMBER
      ? BigInt(process.env.BUYS_FROM_BLOCK_NUMBER)
      : undefined,
    eventName: "Swap",
    onError: (error) => {
      console.error("There was an error watching the contract events", error);
      sendLogToChannel(`Error watching contract events: ${error}`);
    },
    onLogs: (logs) => {
      for (const log of logs) {
        try {
          const { amount0, amount1 } = log.args;
          const poolInfo = poolTokens.find(
            (p) => p.pool.toLowerCase() === log.address.toLowerCase()
          );
          if (!poolInfo || amount0 === undefined || amount1 === undefined)
            continue;

          const isBuy = poolInfo.isWethToken0 ? amount1 < 0n : amount0 < 0n;

          if (isBuy) {
            const ethAmount = convertToPositive(
              poolInfo.isWethToken0 ? amount0 : amount1
            );
            const tokenAmount = convertToPositive(
              poolInfo.isWethToken0 ? amount1 : amount0
            );
            handleBuyEvent(
              log,
              chats,
              ethAmount,
              tokenAmount,
              ethUsdPrice,
              holdersCounts
            );
          }
        } catch (error) {
          console.error(`Error processing log: ${error}`, log);
          sendLogToChannel(`Error processing buy event: ${error}`);
        }
      }
    },
  });
}

async function handleBuyEvent(
  log: any,
  chats: ChatResponse,
  ethAmount: bigint,
  tokenAmount: bigint,
  ethUsdPrice: number,
  holdersCounts: Record<string, number>
) {
  const matchingChats = Object.values(chats).filter(
    (chat) => chat.pools?.UniswapV3?.toLowerCase() === log.address.toLowerCase()
  );
  if (matchingChats.length === 0) return;

  try {
    const amountInEth = Number(formatUnits(ethAmount, 18));
    const spentAmount = amountInEth * ethUsdPrice;

    const transaction = await client
      .getTransaction({
        hash: log.transactionHash,
      })
      .catch((error) => {
        throw new Error(`Failed to fetch transaction: ${error}`);
      });

    const actualBuyer = transaction.from;

    const balance = await client
      .readContract({
        address: matchingChats[0].info.id as `0x${string}`,
        abi: [ERC20_BALANCE_ABI],
        functionName: "balanceOf",
        args: [actualBuyer],
      })
      .catch((error) => {
        throw new Error(`Failed to read balance: ${error}`);
      });

    const formattedBalance = formatUnits(
      balance,
      Number(matchingChats[0].info.decimals)
    );

    const amountIn = formatUnits(ethAmount, 18);
    const amountOut = formatUnits(
      tokenAmount,
      Number(matchingChats[0].info.decimals)
    );

    const ethPricePerToken = Number(amountIn) / Number(amountOut);
    const spentAmountUsd = Number(amountIn) * ethUsdPrice;
    const balanceAmountUsd =
      Number(formattedBalance) * ethPricePerToken * ethUsdPrice;

    for (const chat of matchingChats) {
      if (
        chat.settings?.minBuyAmount &&
        spentAmount < chat.settings.minBuyAmount
      ) {
        continue;
      }

      const emojiCount = Math.max(
        1,
        Math.floor(spentAmountUsd / (chat.settings?.minBuyAmount ?? 10))
      );
      const baseEmoji = chat.settings?.emoji ?? "🟢";
      const emojiString = baseEmoji.repeat(emojiCount);
      const buyerPosition =
        balance - BigInt(tokenAmount) > 0n
          ? `${_n(formattedBalance)} ${chat.info.symbol} ($${_n(
              balanceAmountUsd
            )})`
          : "🌟 New Buyer!";

      const queryParams = {};
      const media = await getBuyMedia(chat, log.transactionHash, queryParams);
      const message = `
*${chat.info.symbol} Buy!*
${emojiString}
*Spent:* ${_n(amountIn)} WETH ($${_n(spentAmountUsd)})
*Received:* ${_n(amountOut)} ${chat.info.symbol}
*Buyer:* ${shortenAddress(actualBuyer, true)}
*Buyer Position:* ${buyerPosition}
*Price:* $${_n(ethPricePerToken * ethUsdPrice)}
*MarketCap:* $${_n(
        Number(chat.info.totalSupply) * ethPricePerToken * ethUsdPrice
      )}

[TX](${`https://basescan.org/tx/${log.transactionHash}`}) | [DEX](${`https://dexscreener.com/base/${chat.info.id}`}) | [BUY](${`https://app.uniswap.org/explore/tokens/base/${chat.info.id}`})
      `;

      if (media?.data && media.type) {
        await sendMediaToChat(
          chat.id,
          media.data,
          media.type,
          message,
          chat.threadId
        );
      } else {
        await sendMessageToChat(chat.id, message, chat.threadId);
      }
    }
  } catch (error) {
    console.error(`Error handling buy event: ${error}`, {
      txHash: log.transactionHash,
      pool: log.address,
    });

    sendLogToChannel(`Error handling buy event: ${error}`);
  }
}

async function getBuyMedia(
  chat: ChatEntry,
  transactionHash: string,
  queryParams: Record<string, string>
) {
  if (chat.settings?.imageWebhookUrl && transactionHash) {
    const queryString = new URLSearchParams(queryParams);
    const webhookUrl = `${chat.settings.imageWebhookUrl}/${transactionHash}?${queryString}`;

    try {
      const response = await fetch(webhookUrl);

      if (!response.ok) {
        console.error(
          `Failed to fetch media: ${response.status} ${response.statusText}`
        );
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get("content-type")?.toLowerCase();
      if (!contentType) {
        console.error("No content-type header received from media webhook");
        throw new Error("Missing content-type header");
      }

      let mediaType: "video" | "photo" | "animation" = "photo";

      if (contentType.includes("video")) {
        mediaType = "video";
      } else if (contentType.includes("gif")) {
        mediaType = "animation";
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        console.error("Received empty media response");
        throw new Error("Empty media response");
      }

      return {
        data: Buffer.from(arrayBuffer),
        type: mediaType,
      };
    } catch (error) {
      console.error("Error fetching media from webhook:", error);
    }
  }

  const imageData = chat.settings?.thresholds?.[0];
  if (imageData) {
    return {
      data: imageData.fileId,
      type: imageData.type,
    };
  }

  return null;
}
