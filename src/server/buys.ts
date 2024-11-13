import { parseAbiItem, formatUnits } from "viem";
import { Resvg } from "@resvg/resvg-js";
import { sendImageToChat } from "../bot";
import {
  shortenAddress,
  convertToPositive,
  _n,
  getEthUsdPrice,
  getTokenHoldersCount,
} from "../utils";
import client from "../client";

interface TokenInfo {
  decimals: string;
  id: string;
  name: string;
  symbol: string;
  totalSupply: string;
}

interface Pools {
  UniswapV2?: string;
  UniswapV3?: string;
}

interface ChatEntry {
  id: string;
  info: TokenInfo;
  pools: Pools;
  settings?: {
    emoji?: string;
    imageUrl?: string;
  };
}

interface ChatResponse {
  [key: string]: ChatEntry;
}

const UNISWAP_V3_POOL_ABI = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"
);

const ERC20_BALANCE_ABI = parseAbiItem(
  "function balanceOf(address) view returns (uint256)"
);

function getInscriptionABI(symbol: string) {
  if (symbol === "TRUFFI")
    return {
      name: "dynamicInscription",
      abi: "function dynamicInscription(address) view returns ((uint256 seed, uint256 extra, address creator))",
    };
  if (symbol === "JELLI")
    return {
      name: "polypsDegree",
      abi: "function polypsDegree(address) view returns ((uint256 seed, uint256 extra))",
    };
  if (symbol === "FUNGI")
    return {
      name: "sporesDegree",
      abi: "function sporesDegree(address) view returns ((uint256 seed, uint256 extra))",
    };
  return {
    name: "dynamicInscription",
    abi: "function dynamicInscription(address) view returns ((uint256 seed, uint256 extra))",
  };
}

function getSvgABI(symbol: string) {
  if (symbol === "TRUFFI") {
    return "function getSvg((uint256 seed, uint256 extra, address creator)) view returns (string)";
  }
  return "function getSvg((uint256 seed, uint256 extra)) view returns (string)";
}

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
    fromBlock: 22338955n,
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

async function fetchChats(): Promise<ChatResponse> {
  return fetch(process.env.CHATS_API_URL!)
    .then((res) => res.json())
    .then((json) => json.data);
}

async function handleBuyEvent(
  log: any,
  chats: ChatResponse,
  ethAmount: bigint,
  tokenAmount: bigint,
  ethUsdPrice: number,
  holdersCounts: Record<string, number>
) {
  const transaction = await client.getTransaction({
    hash: log.transactionHash,
  });

  const actualBuyer = transaction.from;

  const chat = Object.values(chats).find(
    (chat) => chat.pools.UniswapV3?.toLowerCase() === log.address.toLowerCase()
  );

  if (!chat) return;

  const balance = await client.readContract({
    address: chat.info.id as `0x${string}`,
    abi: [ERC20_BALANCE_ABI],
    functionName: "balanceOf",
    args: [actualBuyer],
  });

  const png = await getPng(chat, actualBuyer);
  if (!png) return;

  const formattedBalance = formatUnits(balance, Number(chat.info.decimals));

  const amountIn = formatUnits(ethAmount, 18);
  const amountOut = formatUnits(tokenAmount, Number(chat.info.decimals));

  const ethPricePerToken = Number(amountIn) / Number(amountOut);
  const spentAmountUsd = Number(amountIn) * ethUsdPrice;

  const emojiCount = Math.max(1, Math.floor(spentAmountUsd / 10));
  const baseEmoji = chat.settings?.emoji || "🟢";
  const emojiString = baseEmoji.repeat(emojiCount);

  sendImageToChat(
    chat.id,
    png,
    `
*${chat.info.symbol} Buy!* 
${emojiString}
*Spent:* ${_n(amountIn)} WETH ($${_n(spentAmountUsd)})
*Received:* ${_n(amountOut)} ${chat.info.symbol}
*New Balance:* ${_n(formattedBalance)} ${chat.info.symbol}
*Price:* $${_n(ethPricePerToken * ethUsdPrice)}
*Address:* ${shortenAddress(actualBuyer, true)}
*MarketCap:* $${_n(
      Number(chat.info.totalSupply) * ethPricePerToken * ethUsdPrice,
      0
    )}
*Holders:* ${holdersCounts[chat.info.id]}

[TX](${`https://basescan.org/tx/${log.transactionHash}`}) | [DEX](${`https://dexscreener.com/base/${chat.info.id}`}) | [BUY](${`https://app.uniswap.org/explore/tokens/base/${chat.info.id}`})
    `
  );
}

async function getSvg(inscription: any, contract: string, symbol: string) {
  return client.readContract({
    address: contract as `0x${string}`,
    abi: [parseAbiItem(getSvgABI(symbol))],
    functionName: "getSvg",
    args: [inscription],
  });
}

async function getDynamicInscription(
  contract: string,
  address: `0x${string}`,
  symbol: string
) {
  const inscriptionABI = getInscriptionABI(symbol);

  const inscription = (await client.readContract({
    address: contract as `0x${string}`,
    abi: [parseAbiItem(inscriptionABI.abi)],
    functionName: inscriptionABI.name,
    args: [address],
  })) as any;

  return inscription;
}

async function getPng(chat: ChatEntry, actualBuyer: `0x${string}`) {
  const inscription = await getDynamicInscription(
    chat.info.id,
    actualBuyer,
    chat.info.symbol
  );
  if (!inscription) return;
  if (inscription.seed === 0n) return;
  // console.log("No inscription found for:", address);

  let png: Buffer | undefined;

  if (chat.settings?.imageUrl) {
    const normalizedInscription = {
      seed: Number(inscription.seed),
      extra: Number(inscription.extra),
      ...(inscription.creator && { creator: inscription.creator }),
    };
    const inscriptionDataArray = new URLSearchParams(
      normalizedInscription
    ).toString();
    const imgBuffer = await fetch(
      `${chat.settings.imageUrl}?${inscriptionDataArray}`
    ).then((res) => res.arrayBuffer());
    return Buffer.from(imgBuffer);
  }

  const svg = await getSvg(inscription, chat.info.id, chat.info.symbol);
  if (!svg) return;

  png = new Resvg(svg, {
    fitTo: { mode: "width", value: 440 },
  })
    .render()
    .asPng();

  return png;
}
