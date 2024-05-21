// import { client } from "./client";
// const eventsAbi = require("../abi/Events.json");

export async function setParticipant(
  address: string,
  telegram: string,
  event: number
) {
  const response = await fetch(
    `https://asia-southeast1-shrooms-9823a.cloudfunctions.net/events-participate/${event}?token=ItsMeTruffyBotDude15kk`,
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

export async function getParticipants(event: number) {
  const response = await fetch(
    `https://asia-southeast1-shrooms-9823a.cloudfunctions.net/events-participants/${event}?token=ItsMeTruffyBotDude15kk`
  );
  return response.json();
}

export async function getEvent(event: number) {
  const response = await fetch(
    `https://asia-southeast1-shrooms-9823a.cloudfunctions.net/events-event/${event}`
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

// export async function initEvent(event: any) {
//   const { request: requestInit } = await client.simulateContract({
//     account: "0x3901D0fDe202aF1427216b79f5243f8A022d68cf",
//     address: "0xdcC928a7B826fdb87B6aC3b7988FbA8841f159F5",
//     abi: eventsAbi,
//     functionName: "initEvent",
//     args: [event.prize, event.maxParticipants],
//   });
//   const hash = await client.writeContract(requestInit);
//   await client.waitForTransactionReceipt(hash);
// }

// export async function startEvent(event: any) {
//   const { request: requestStart } = await client.simulateContract({
//     account: "0x3901D0fDe202aF1427216b79f5243f8A022d68cf",
//     address: "0xdcC928a7B826fdb87B6aC3b7988FbA8841f159F5",
//     abi: eventsAbi,
//     functionName: "startEvent",
//     args: [event.participants, event.end, event.slots],
//   });
//   const hash = await client.writeContract(requestStart);
//   await client.waitForTransactionReceipt(hash);
// }
