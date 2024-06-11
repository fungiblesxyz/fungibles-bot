export function getStartMessage(
  index: number,
  timeString: string,
  prize: number,
  max: number
): string {
  return `
🌕🍄🌕🍄🌕🍄🌕🍄🌕🍄🌕

<b> Welcome to the Truffi Community Event ${Number(index) + 1}! </b>

🌕🍄🌕🍄🌕🍄🌕🍄🌕🍄🌕

<b>🚀 How to Join:</b> Reply to this message with your ETH address to sign up!

🕒 <b>Countdown:</b> The event kicks off in ${timeString}.

👥 <b>Spots Available:</b> Hurry, only ${max} spots left!

💰 <b>Prize Pool:</b> ${Intl.NumberFormat("en", { notation: "compact" }).format(
    prize
  )} TRUFFI 💰

🍀 <b>Good Luck & Have Fun!</b> 🍀
`;
}
