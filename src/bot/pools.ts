const UNISWAP_V2_SUBGRAPH =
  "https://gateway.thegraph.com/api/cef233fe032b15e9a0b8edd107bdae0f/subgraphs/id/C4cSs45WiwmUqyN7WCR6rFRitEhPEXSKt3uabL2tWinu";
const UNISWAP_V3_SUBGRAPH =
  "https://gateway.thegraph.com/api/cef233fe032b15e9a0b8edd107bdae0f/subgraphs/id/GqzP4Xaehti8KSfQmv3ZctFSjnSUYZ4En5NRsiTbvZpz";

interface V2Pool {
  id: string;
  token0: { symbol: string; id: string };
  token1: { symbol: string; id: string };
  reserveETH: string;
  token0Price: string;
  token1Price: string;
}

interface V3Pool {
  id: string;
  token0: { symbol: string; id: string };
  token1: { symbol: string; id: string };
  totalValueLockedETH: string;
}

interface TokenInfo {
  symbol: string;
  name?: string;
  decimals?: string;
  totalSupply?: string;
}

interface PoolsResponse {
  info: TokenInfo;
  pools: {
    UniswapV2?: string;
    UniswapV3?: string;
  };
}

export async function getUniswapV2Pools(
  tokenAddress: string
): Promise<V2Pool[]> {
  const response = await fetch(UNISWAP_V2_SUBGRAPH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `{
        token0Pairs: pairs(where: {token0: "${tokenAddress.toLowerCase()}"}) {
          id
          token0 {
            id 
            symbol
            name
            decimals
          }
          token1 { id }
        }
        token1Pairs: pairs(where: {token1: "${tokenAddress.toLowerCase()}"}) {
          id
          token0 { id }
          token1 {
            id
            symbol
            name
            decimals
          }
        }
      }`,
    }),
  });

  const data = await response.json();
  return [...(data.data?.token0Pairs || []), ...(data.data?.token1Pairs || [])];
}

export async function getUniswapV3Pools(
  tokenAddress: string
): Promise<V3Pool[]> {
  const response = await fetch(UNISWAP_V3_SUBGRAPH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `{
        token0Pools: pools(where: {token0: "${tokenAddress.toLowerCase()}"}) {
          id
          token0 { 
            id
            symbol
            name
            decimals
          }
          token1 { id }
        }
        token1Pools: pools(where: {token1: "${tokenAddress.toLowerCase()}"}) {
          id
          token0 { id }
          token1 { 
            id
            symbol
            name
            decimals
          }
        }
      }`,
    }),
  });

  const data = await response.json();
  return [...(data.data?.token0Pools || []), ...(data.data?.token1Pools || [])];
}

export async function getPools(
  tokenAddress: string
): Promise<PoolsResponse | null> {
  const WETH = "0x4200000000000000000000000000000000000006";
  const [v2Pairs, v3Pools] = await Promise.all([
    getUniswapV2Pools(tokenAddress),
    getUniswapV3Pools(tokenAddress),
  ]);

  // Combine and filter V2 pairs
  const wethV2Pair = v2Pairs.find(
    (pair) =>
      pair.token0.id?.toLowerCase() === WETH ||
      pair.token1.id?.toLowerCase() === WETH
  );

  // Combine and filter V3 pools
  const wethV3Pool = v3Pools.find(
    (pool) =>
      pool.token0.id?.toLowerCase() === WETH ||
      pool.token1.id?.toLowerCase() === WETH
  );

  if (!wethV2Pair && !wethV3Pool) return null;

  const tokenInfo: TokenInfo = (wethV3Pool &&
  wethV3Pool.token0.id.toLowerCase() === tokenAddress.toLowerCase()
    ? wethV3Pool.token0
    : wethV3Pool?.token1) ||
    (wethV2Pair &&
    wethV2Pair.token0.id.toLowerCase() === tokenAddress.toLowerCase()
      ? wethV2Pair.token0
      : wethV2Pair?.token1) || { symbol: "UNKNOWN" };

  return {
    info: tokenInfo,
    pools: {
      UniswapV2: wethV2Pair?.id,
      UniswapV3: wethV3Pool?.id,
    },
  };
}
