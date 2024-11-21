import { getDaysSince } from "../utils";

const lastSaleQueryString = `
    query GetLatestSell($address: String!, $token: String!, $pool: String!) {
      swaps(
        where: {
          origin: $address, 
          token0: $token,
          pool: $pool
          amount0_gt: 0
        }
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        timestamp
        amount0
        amount1
        transaction {
          id
        }
      }
    }
  `;

const firstBuyQueryString = `
    query GetLatestBuy($address: String!, $token: String!, $pool: String!) {
      swaps(
        where: {
          origin: $address, 
          token0: $token,
          pool: $pool
          amount0_lt: 0
        }
        orderBy: timestamp
        orderDirection: asc
      ) {
        id
        timestamp
        amount0
        amount1
        transaction {
          id
        }
      }
    }
  `;

async function getSwaps(
  address: string,
  token: string,
  pool: string,
  query: string
) {
  const response = await fetch(
    `https://gateway.thegraph.com/api/${process.env.THEGRAPH_API_KEY}/subgraphs/id/43Hwfi3dJSoGpyas9VwNoDAv55yjgGrPpNSmbQZArzMG`,
    {
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
        },
      }),
    }
  );

  const data = await response.json();
  return data.data.swaps[0];
}

export async function getStats(
  address: string,
  token: string,
  pool: string,
  isWethToken0: boolean
) {
  // TODO: handle weth token0
  const lastSale = await getSwaps(address, token, pool, lastSaleQueryString);
  if (lastSale)
    return { heldForDays: getDaysSince(lastSale.timestamp), hasSold: true };
  const firstBuy = await getSwaps(address, token, pool, firstBuyQueryString);
  if (firstBuy) return { heldForDays: getDaysSince(firstBuy.timestamp) };
  return null;
}
