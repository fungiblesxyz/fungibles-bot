import { parseAbiItem, formatUnits } from "viem";
import { sendMediaToChat, sendMessageToChat } from "../helpers/bot";
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
  chats = await fetchChats();
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

  const ethUsdPrice = await getEthUsdPrice(client);
  const holdersCounts = await getTokenHoldersCount(chats, client);

  const v3Pools = Object.values(chats)
    .map((chat) => chat.pools.UniswapV3)
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

  client.watchContractEvent({
    address: v3Pools as `0x${string}`[],
    abi: [UNISWAP_V3_POOL_ABI],
    pollingInterval: 5000,
    fromBlock: 22551763n,
    eventName: "Swap",
    onError: (error) => {
      console.error("There was an error watching the contract events", error);
    },
    onLogs: (logs) => {
      for (const log of logs) {
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
  const chat = Object.values(chats).find(
    (chat) => chat.pools.UniswapV3?.toLowerCase() === log.address.toLowerCase()
  );
  if (!chat) return;

  const amountInEth = Number(formatUnits(ethAmount, 18));
  const spentAmount = amountInEth * ethUsdPrice;
  if (chat.settings?.minBuyAmount && spentAmount < chat.settings.minBuyAmount) {
    return;
  }

  const transaction = await client.getTransaction({
    hash: log.transactionHash,
  });

  const actualBuyer = transaction.from;

  const balance = await client.readContract({
    address: chat.info.id as `0x${string}`,
    abi: [ERC20_BALANCE_ABI],
    functionName: "balanceOf",
    args: [actualBuyer],
  });
  if (!balance) return;

  const formattedBalance = formatUnits(balance, Number(chat.info.decimals));

  const amountIn = formatUnits(ethAmount, 18);
  const amountOut = formatUnits(tokenAmount, Number(chat.info.decimals));

  const ethPricePerToken = Number(amountIn) / Number(amountOut);
  const spentAmountUsd = Number(amountIn) * ethUsdPrice;
  const balanceAmountUsd =
    Number(formattedBalance) * ethPricePerToken * ethUsdPrice;

  const emojiCount = Math.max(1, Math.floor(spentAmountUsd / 10));
  const baseEmoji = chat.settings?.emoji || "🟢";
  const emojiString = baseEmoji.repeat(emojiCount);
  const buyerPosition =
    balance - BigInt(tokenAmount) > 0n
      ? `${_n(formattedBalance)} ${chat.info.symbol} ($${_n(balanceAmountUsd)})`
      : "🌟 New!";

  const queryParams = {};
  const media = await getBuyMedia(chat, log.transactionHash, queryParams);
  const message = `
*${chat.info.symbol} Buy!*
${emojiString}
*Spent:* ${_n(amountIn)} WETH ($${_n(spentAmountUsd)})
*Received:* ${_n(amountOut)} ${chat.info.symbol}
*Buyer Position:* ${buyerPosition}
*Address:* ${shortenAddress(actualBuyer, true)}
*Price:* $${_n(ethPricePerToken * ethUsdPrice)}
*MarketCap:* $${_n(
    Number(chat.info.totalSupply) * ethPricePerToken * ethUsdPrice
  )}
*Holders:* ${_n(holdersCounts[chat.info.id])}

[TX](${`https://basescan.org/tx/${log.transactionHash}`}) | [DEX](${`https://dexscreener.com/base/${chat.info.id}`}) | [BUY](${`https://app.uniswap.org/explore/tokens/base/${chat.info.id}`})
  `;

  if (media?.data && media.type) {
    sendMediaToChat(chat.id, media.data, media.type, message);
  } else {
    sendMessageToChat(chat.id, message);
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
