export function getStartMessage(
  index: number,
  timeString: string,
  prize: number
): string {
  return `
🌕🍄🌕🍄🌕🍄🌕🍄🌕🍄🌕

<b>Truffi Event ${Number(index) + 1} Signup!</b>

🌕🍄🌕🍄🌕🍄🌕🍄🌕🍄🌕

<b>Reply with your ETH address to this message to participate.</b> The event will start in ${timeString} at truffi.xyz/collect/collect

There are only 50 spots available for this event! 

💰 Prize pool: ${prize} TRUFFI 💰

🌟 Good luck! 🌟 
`;
}
