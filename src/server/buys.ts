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
  fetchChats,
} from "../helpers/utils";
import client from "../helpers/client";
import { ChatResponse, ChatEntry, BuyEventData } from "../helpers/types";
import { getStats } from "../helpers/queries/stats";
const UNISWAP_V3_POOL_ABI = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"
);

const ERC20_BALANCE_ABI = parseAbiItem(
  "function balanceOf(address) view returns (uint256)"
);

let chats: ChatResponse;
let ethUsdPrice: number;
let unwatchSwaps: ReturnType<typeof client.watchContractEvent> | null = null;

export async function refreshData() {
  try {
    ethUsdPrice = await getEthUsdPrice(client);
    const newChats = await fetchChats();
    const filteredChats = Object.entries(newChats)
      .filter(([_, chat]) => chat?.info?.id)
      .reduce(
        (acc, [key, chat]) => ({
          ...acc,
          [key]: chat,
        }),
        {}
      ) as ChatResponse;

    if (JSON.stringify(chats) !== JSON.stringify(filteredChats)) {
      chats = filteredChats;
      if (unwatchSwaps) {
        unwatchSwaps();
        await monitorBuys();
      }
    }
  } catch (error) {
    console.error("Failed to update chats:", error);
    sendLogToChannel(`Failed to update chats: ${error}`);
  }
}

export async function monitorBuys() {
  if (ethUsdPrice === 0) {
    throw new Error("ETH price is 0");
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

  unwatchSwaps = client.watchContractEvent({
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
              poolInfo.isWethToken0
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

async function formatBuyMessage(chat: ChatEntry, data: BuyEventData) {
  const emojiCount = Math.max(
    1,
    Math.floor(data.amounts.spentUsd / (chat.settings?.emojiStepAmount ?? 10))
  );
  const baseEmoji = chat.settings?.emoji ?? "🟢";
  const emojiString = baseEmoji.repeat(emojiCount);

  const buyerPosition = `${_n(data.buyer.formattedBalance)} ${
    chat.info.symbol
  } ($${_n(data.amounts.balanceUsd)})`;

  const heldForDays = data.buyer.stats?.heldForDays;

  const marketCapUsd = _n(
    Number(chat.info.totalSupply) * data.prices.ethPerToken * data.prices.ethUsd
  );

  let buyerStatus;
  if (heldForDays < 7) buyerStatus = "🌟 New Buyer";
  if (heldForDays >= 7) buyerStatus = "🦾 Iron Hands";
  if (heldForDays >= 30) buyerStatus = "💎 Diamond Hands";
  if (data.buyer.balance <= 0) buyerStatus = "⚡ Quick Flip";

  let messageLines = [
    `*${chat.info.symbol} Buy!*`,
    emojiString,
    `*Spent:* ${_n(data.amounts.in)} WETH ($${_n(data.amounts.spentUsd)})`,
    `*Received:* ${_n(data.amounts.out)} ${chat.info.symbol}`,
    `*Buyer:* ${shortenAddress(data.buyer.address, true)}`,
    `*Buyer Status:* ${buyerStatus}`,
    data.buyer.balance > 0 && `*Buyer Position:* ${buyerPosition}`,
    `*Price:* $${_n(data.prices.ethPerToken * data.prices.ethUsd)}`,
    `*MarketCap:* $${marketCapUsd}`,
    `\n[TX](https://basescan.org/tx/${data.transaction.hash}) | [DEX](https://dexscreener.com/base/${chat.info.id}) | [BUY](https://app.uniswap.org/explore/tokens/base/${chat.info.id})`,
  ];

  messageLines = messageLines.filter((line) => line);

  return messageLines.join("\n");
}

async function handleBuyEvent(
  log: any,
  chats: ChatResponse,
  ethAmount: bigint,
  tokenAmount: bigint,
  ethUsdPrice: number,
  isWethToken0: boolean
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

    const stats = await getStats(
      actualBuyer,
      matchingChats[0].info.id,
      log.address,
      isWethToken0
    );

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

      const buyEventData: BuyEventData = {
        buyer: {
          address: actualBuyer,
          balance,
          formattedBalance,
          isNew: balance - BigInt(tokenAmount) < 0n,
          stats,
        },
        amounts: {
          in: amountIn,
          out: amountOut,
          spentUsd: spentAmountUsd,
          balanceUsd: balanceAmountUsd,
        },
        prices: {
          ethPerToken: ethPricePerToken,
          ethUsd: ethUsdPrice,
        },
        transaction: {
          hash: log.transactionHash,
        },
      };

      const message = await formatBuyMessage(chat, buyEventData);

      if (log.transactionHash) {
        const media = await getBuyMedia(
          chat,
          log.transactionHash,
          spentAmountUsd
        );
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
  spentUsd: number
) {
  const queryParams = {};
  const thresholds = chat.settings?.thresholds;
  if (!thresholds) return null;

  const appropriateThreshold = thresholds
    .filter((t) => t.threshold <= spentUsd)
    .sort((a, b) => b.threshold - a.threshold)[0];

  if (appropriateThreshold && !appropriateThreshold.customWebhookUrl) {
    return {
      data: appropriateThreshold.fileId,
      type: appropriateThreshold.type,
    };
  }

  if (!transactionHash) return null;

  const queryString = new URLSearchParams(queryParams);
  const webhookUrl = `${appropriateThreshold.customWebhookUrl}/${transactionHash}?${queryString}`;

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
    sendLogToChannel(`Error fetching media from webhook: ${error}`);
  }
}
