import { formatNumber } from "./utils";

export function getStartMessage(
  index: number,
  timeString: string,
  prize: number,
  max: number
): string {
  return `
🌕🍄🌕🍄🌕🍄🌕🍄🌕🍄🌕

<b> Truffi Hunt is Starting Now! </b>

🌕🍄🌕🍄🌕🍄🌕🍄🌕🍄🌕

<b>🚀 How to Join:</b> Reply to this message with your ETH address to participate in the Hunt!

💰 <b>Potential Prize Pool:</b> ${formatNumber(prize)} TRUFFI 💰

🍀 <b>Good Luck & Have Fun!</b> 🍀
`;
}
