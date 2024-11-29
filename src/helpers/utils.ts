import { PublicClient, parseAbiItem } from "viem";
import { ChatResponse } from "./types";
import { sendLogToChannel } from "./bot";

export function shortenAddress(address: string, includeLink = false): string {
  const shortened = `${address.slice(0, 6)}...${address.slice(-4)}`;
  return includeLink
    ? `[${shortened}](https://basescan.org/address/${address})`
    : shortened;
}

export function convertToPositive(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function _n(value: number | string): string {
  const num = Number(value);
  if (num === 0) return "0.00";

  if (num < 1) {
    // Find position of first non-zero digit after decimal
    const decimalStr = num.toFixed(20);
    const regex = /\.0*[1-9]/;
    const match = regex.exec(decimalStr);
    const firstNonZero = match ? match[0].length - 1 : 0;
    // Show at least 4 digits after the first non-zero
    const decimals = Math.min(firstNonZero + 3, 20);
    return num.toFixed(decimals);
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(num);
}

export async function getEthUsdPrice(client: PublicClient): Promise<number> {
  const USDC_WETH_POOL = "0xd0b53D9277642d899DF5C87A3966A349A798F224";
  const USDC_DECIMALS = 6;

  try {
    const poolData = (await client.readContract({
      address: USDC_WETH_POOL as `0x${string}`,
      abi: [
        parseAbiItem(
          "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
        ),
      ],
      functionName: "slot0",
    })) as any;

    const sqrtPriceX96 = poolData[0];
    const price = (Number(sqrtPriceX96) / 2 ** 96) ** 2;
    return price * 10 ** (USDC_DECIMALS * 2);
  } catch (error) {
    console.error("Error fetching ETH/USD price:", error);
    return 0;
  }
}

export async function getTokenHoldersCount(
  chats: any,
  client: PublicClient
): Promise<Record<string, number>> {
  const chatIds = Object.values(chats).map((chat: any) => chat.info.id);
  const holdersCounts = await Promise.all(
    chatIds.map(async (id) => {
      const holders = await client.readContract({
        address: id as `0x${string}`,
        abi: [parseAbiItem("function holdersCount() view returns (uint256)")],
        functionName: "holdersCount",
      });
      return {
        id,
        holders,
      };
    })
  );

  const mappedHoldersCounts = holdersCounts.reduce(
    (acc, { id, holders }) => ({
      ...acc,
      [id]: Number(holders),
    }),
    {} as Record<string, number>
  );

  return mappedHoldersCounts;
}

export async function fetchChats(): Promise<ChatResponse> {
  try {
    const response = await fetch(process.env.CHATS_API_URL!);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    return json.data || {};
  } catch (error) {
    console.error("Failed to fetch chats:", error);
    sendLogToChannel(`Failed to fetch chats: ${error}`);
    return {};
  }
}

export async function fetchChatData(chatId: string | number | undefined) {
  if (!chatId) return {};
  try {
    const response = await fetch(`${process.env.CHATS_API_URL}/${chatId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    return json.data || {};
  } catch (error) {
    console.error(`Failed to fetch chat data for ${chatId}:`, error);
    sendLogToChannel(`Failed to fetch chat data: ${error}`, {
      chatId,
    });
    return {};
  }
}

export function getDaysSince(timestamp: number) {
  const currentTimestampSeconds = Math.floor(Date.now() / 1000);
  return Math.floor((currentTimestampSeconds - timestamp) / (60 * 60 * 24));
}
