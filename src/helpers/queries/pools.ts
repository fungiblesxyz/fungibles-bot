import { Address, PublicClient, formatUnits } from "viem";
import { sendLogToChannel } from "../bot";

// Constants
const UNISWAP_V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
const WETH = "0x4200000000000000000000000000000000000006";
const FEE_TIERS = [100, 500, 3000, 10000] as const;

interface TokenInfo {
  id: Address;
  symbol: string;
  name?: string;
  decimals?: string;
  totalSupply?: string;
}

interface PoolsResponse {
  info: TokenInfo;
  pools: {
    UniswapV3?: string;
  };
}

export async function getPools(
  tokenAddress: Address,
  publicClient: PublicClient
): Promise<PoolsResponse | null> {
  try {
    const v3PoolPromises = FEE_TIERS.map(async (fee) => {
      try {
        return await publicClient.readContract({
          address: UNISWAP_V3_FACTORY,
          abi: [
            {
              inputs: [
                { type: "address" },
                { type: "address" },
                { type: "uint24" },
              ],
              name: "getPool",
              outputs: [{ type: "address" }],
              stateMutability: "view",
              type: "function",
            },
          ],
          functionName: "getPool",
          args: [tokenAddress, WETH, fee],
        });
      } catch (error) {
        console.error(`Failed to fetch pool for fee tier ${fee}:`, error);
        return "0x0000000000000000000000000000000000000000";
      }
    });

    const [tokenInfo, ...v3Pools] = await Promise.all([
      getTokenInfo(tokenAddress, publicClient),
      ...v3PoolPromises,
    ]);

    const v3Pool = v3Pools.find(
      (pool) => pool !== "0x0000000000000000000000000000000000000000"
    );

    if (!v3Pool) {
      return null;
    }

    return {
      info: tokenInfo,
      pools: {
        UniswapV3: v3Pool,
      },
    };
  } catch (error) {
    console.error("Failed to get pools:", error);
    sendLogToChannel(`Failed to get pools: ${error}`);
    return null;
  }
}

async function getTokenInfo(
  tokenAddress: Address,
  publicClient: PublicClient
): Promise<TokenInfo> {
  try {
    const [symbol, name, decimals, totalSupply] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            inputs: [],
            name: "symbol",
            outputs: [{ type: "string" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "symbol",
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            inputs: [],
            name: "name",
            outputs: [{ type: "string" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "name",
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            inputs: [],
            name: "decimals",
            outputs: [{ type: "uint8" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "decimals",
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            inputs: [],
            name: "totalSupply",
            outputs: [{ type: "uint256" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "totalSupply",
      }),
    ]);

    return {
      id: tokenAddress,
      symbol,
      name,
      decimals: decimals.toString(),
      totalSupply: formatUnits(totalSupply, decimals),
    };
  } catch (error) {
    console.error("Error fetching token info:", error);
    return { id: tokenAddress, symbol: "UNKNOWN" };
  }
}
