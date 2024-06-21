import { parseUnits } from "viem";

const BASESCAN_API = "https://api.basescan.org/api";
const BASESCAN_KEY = "ZZ67624C6BAE8YWRDW1MXS2FA7SRHQJDEE";
const TRUFFI_CONTRACT = "0x2496a9AF81A87eD0b17F6edEaf4Ac57671d24f38";

export async function setParticipant(
  address: string,
  telegram: string,
  index: number
) {
  const response = await fetch(
    `${process.env.EVENTS_API_URL}-participate/${index}?token=ItsMeTruffyBotDude15kk`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address, telegram }),
    }
  );
  return response;
}

export async function hasBalanceReq(address: string) {
  const response = await fetch(
    `${BASESCAN_API}?module=account&action=tokenbalance&contractaddress=${TRUFFI_CONTRACT}&address=${address}&tag=latest&apikey=${BASESCAN_KEY}`
  );
  const { result } = await response.json();

  if (parseUnits(result, 9) < 3500) {
    return false;
  }
  return true;
}

export async function getParticipants(index: number) {
  const response = await fetch(
    `${process.env.EVENTS_API_URL}-participants/${index}?token=ItsMeTruffyBotDude15kk`
  );
  return response.json();
}

export async function initEvent({
  index,
  prize,
  timestamp,
  max,
}: {
  index: number;
  prize: number;
  timestamp: number;
  max: number;
}) {
  const response = await fetch(
    `${process.env.EVENTS_API_URL}-init/${index}?token=ItsMeTruffyBotDude15kk`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ index, prize, timestamp, max }),
    }
  );
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message);
  }

  return json;
}
