export function getTimeString(timestamp: number): string {
  const currentTime = Date.now();
  const timeDifference = timestamp - currentTime;
  const hours = Math.floor(timeDifference / (1000 * 60 * 60));
  const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));

  let timeString = `${hours} hour${hours !== 1 ? "s" : ""}`;
  if (minutes > 0) {
    timeString += ` and ${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }

  return timeString;
}
