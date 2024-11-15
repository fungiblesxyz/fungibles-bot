import { parseAbiItem, formatUnits } from "viem";
import { sendMediaToChat } from "../bot";
import {
  shortenAddress,
  convertToPositive,
  _n,
  getEthUsdPrice,
  getTokenHoldersCount,
  fetchChats,
} from "../utils";
import client from "../client";
import { ChatResponse, ChatEntry } from "../types";

const UNISWAP_V3_POOL_ABI = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"
);

const ERC20_BALANCE_ABI = parseAbiItem(
  "function balanceOf(address) view returns (uint256)"
);

export async function monitorBuys() {
  const chats = await fetchChats();
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
    fromBlock: 22423693n,
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

  const image = await getBuyImage(chat);
  console.log("🚀 ~ image:", image);
  if (!image?.fileId || !image.type) return;

  const formattedBalance = formatUnits(balance, Number(chat.info.decimals));

  const amountIn = formatUnits(ethAmount, 18);
  const amountOut = formatUnits(tokenAmount, Number(chat.info.decimals));

  const ethPricePerToken = Number(amountIn) / Number(amountOut);
  const spentAmountUsd = Number(amountIn) * ethUsdPrice;

  const emojiCount = Math.max(1, Math.floor(spentAmountUsd / 10));
  const baseEmoji = chat.settings?.emoji || "🟢";
  const emojiString = baseEmoji.repeat(emojiCount);

  sendMediaToChat(
    chat.id,
    image.fileId,
    image.type,
    `
*${chat.info.symbol} Buy!*
${emojiString}
*Spent:* ${_n(amountIn)} WETH ($${_n(spentAmountUsd)})
*Received:* ${_n(amountOut)} ${chat.info.symbol}
*New Balance:* ${_n(formattedBalance)} ${chat.info.symbol}
*Address:* ${shortenAddress(actualBuyer, true)}
*Price:* $${_n(ethPricePerToken * ethUsdPrice)}
*MarketCap:* $${_n(
      Number(chat.info.totalSupply) * ethPricePerToken * ethUsdPrice
    )}
*Holders:* ${_n(holdersCounts[chat.info.id])}

[TX](${`https://basescan.org/tx/${log.transactionHash}`}) | [DEX](${`https://dexscreener.com/base/${chat.info.id}`}) | [BUY](${`https://app.uniswap.org/explore/tokens/base/${chat.info.id}`})
      `
  );
}

async function getBuyImage(chat: ChatEntry) {
  if (chat.settings?.imageWebhookUrl) {
    const imgBuffer = await fetch(chat.settings.imageWebhookUrl).then((res) =>
      res.arrayBuffer()
    );
    return {
      fileId: Buffer.from(imgBuffer),
      type: "photo" as const,
    };
  }

  const imageData = chat.settings?.thresholds?.[0];
  if (imageData) return imageData;
}
