import type { Bot } from "grammy";

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

export async function isAdmin(
  bot: Bot,
  userId: number,
  chatId: number
): Promise<boolean> {
  try {
    const admins = await bot.api.getChatAdministrators(chatId);
    return admins.some((admin) => admin.user.id === userId);
  } catch (error) {
    console.error("Failed to fetch chat administrators:", error);
    return false;
  }
}

export function formatNumber(number: number): string {
  return Intl.NumberFormat("en", {
    notation: "standard",
  }).format(number);
}
