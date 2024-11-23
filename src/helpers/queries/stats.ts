import { getDaysSince } from "../utils";

const UNISWAP_V3_SUBGRAPH_URL = `https://gateway.thegraph.com/api/${process.env.THEGRAPH_API_KEY}/subgraphs/id/43Hwfi3dJSoGpyas9VwNoDAv55yjgGrPpNSmbQZArzMG`;

const getLastSaleQueryString = (isWethToken0: boolean) => `
    query GetLatestSell($address: String!, $token: String!, $pool: String!) {
      swaps(
        where: {
          origin: $address, 
          ${isWethToken0 ? "token1" : "token0"}: $token,
          pool: $pool,
          ${isWethToken0 ? "amount1_gt" : "amount0_gt"}: "0"
        }
        orderBy: timestamp
        orderDirection: desc
        first: 1
      ) {
        timestamp
      }
    }
  `;

const getFirstBuyQueryString = (isWethToken0: boolean) => `
    query GetLatestBuy($address: String!, $token: String!, $pool: String!) {
      swaps(
        where: {
          origin: $address, 
          ${isWethToken0 ? "token1" : "token0"}: $token,
          pool: $pool,
          ${isWethToken0 ? "amount1_lt" : "amount0_lt"}: "0"
        }
        orderBy: timestamp
        orderDirection: asc
        first: 1
      ) {
        timestamp
      }
    }
  `;

const getBuyAfterLastSaleQueryString = (isWethToken0: boolean) => `
    query GetBuyAfterLastSale($address: String!, $token: String!, $pool: String!, $timestamp: BigInt!) {
      swaps(
        where: {
          origin: $address, 
          ${isWethToken0 ? "token1" : "token0"}: $token,
          pool: $pool,
          ${isWethToken0 ? "amount1_lt" : "amount0_lt"}: "0",
          timestamp_gt: $timestamp
        },
        orderBy: timestamp,
        orderDirection: asc
        first: 1
      ) {
        timestamp
      }
    }
  `;

async function getSwaps(
  address: string,
  token: string,
  pool: string,
  query: string,
  timestamp?: number
) {
  try {
    const response = await fetch(UNISWAP_V3_SUBGRAPH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          address: address.toLowerCase(),
          token: token.toLowerCase(),
          pool: pool.toLowerCase(),
          timestamp,
        },
      }),
    });

    const data = await response.json();

    if (!data || !data.data) {
      console.error("Invalid response from subgraph:", data);
      return null;
    }

    return data.data.swaps?.[0] || null;
  } catch (error) {
    console.error("Error fetching swaps:", error);
    return null;
  }
}

export async function getStats(
  address: string,
  token: string,
  pool: string,
  isWethToken0: boolean
) {
  const lastSale = await getSwaps(
    address,
    token,
    pool,
    getLastSaleQueryString(isWethToken0)
  );
  if (lastSale) {
    const buyAfterLastSale = await getSwaps(
      address,
      token,
      pool,
      getBuyAfterLastSaleQueryString(isWethToken0),
      lastSale.timestamp
    );
    if (buyAfterLastSale) {
      return { heldForDays: getDaysSince(lastSale.timestamp), hasSold: true };
    }
  }
  const firstBuy = await getSwaps(
    address,
    token,
    pool,
    getFirstBuyQueryString(isWethToken0)
  );
  if (firstBuy) return { heldForDays: getDaysSince(firstBuy.timestamp) };
  return null;
}
