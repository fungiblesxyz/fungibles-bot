export function getStartMessage(
  index: number,
  timeString: string,
  prize: number,
  max: number
): string {
  return `
🌕🍄🌕🍄🌕🍄🌕🍄🌕🍄🌕

<b>Truffi Community Event ${Number(index) + 1} Signup!</b>

🌕🍄🌕🍄🌕🍄🌕🍄🌕🍄🌕

<b>Reply with your ETH address to this message to participate.</b> The event will start in ${timeString} at truffi.xyz

There are only ${max} spots available for this event! 

💰 Prize pool: ${Intl.NumberFormat().format(prize)} TRUFFI 💰

🌟 Good luck! 🌟 
`;
}
