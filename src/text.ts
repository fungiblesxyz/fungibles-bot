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

💰 <b>Potential Prize Pool:</b> ${Intl.NumberFormat("en", {
    notation: "compact",
  }).format(prize)} TRUFFI 💰

🍀 <b>Good Luck & Have Fun!</b> 🍀
`;
}
