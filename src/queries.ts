import { parseUnits } from "viem";

const BASESCAN_API = "https://api.basescan.org/api";
const BASESCAN_KEY = "ZZ67624C6BAE8YWRDW1MXS2FA7SRHQJDEE";
const TRUFFI_CONTRACT = "0x2496a9AF81A87eD0b17F6edEaf4Ac57671d24f38";

export async function setParticipant(
  address: string,
  telegram: string,
  event: number
) {
  const response = await fetch(
    `https://asia-southeast1-shrooms-9823a.cloudfunctions.net/eventsTest-participate/${event}?token=ItsMeTruffyBotDude15kk`,
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

  if (parseUnits(result, 9) < 500) {
    return false;
  }
  return true;
}

export async function getParticipants(event: number) {
  const response = await fetch(
    `https://asia-southeast1-shrooms-9823a.cloudfunctions.net/eventsTest-participants/${event}?token=ItsMeTruffyBotDude15kk`
  );
  return response.json();
}

export async function getEvent(event: number) {
  const response = await fetch(
    `https://asia-southeast1-shrooms-9823a.cloudfunctions.net/eventsTest-event/${event}`
  );
  if (!response.ok) {
    throw new Error("Event doesn't exist");
  }
  const json = await response.json();

  if (json.data.event?.end !== 0) {
    throw new Error("Event is already running");
  }

  return json.data.event;
}
