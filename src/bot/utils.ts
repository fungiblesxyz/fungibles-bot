import { bot } from "./index";
import { actionStore } from "./actions";
import { Context } from "grammy";
import { sendLogToChannel } from "../helpers/bot";
import { fetchChats, fetchChatData } from "../helpers/utils";
import { Threshold } from "../helpers/types";

export async function getMatchingChats(userId: number) {
  const chats = await fetchChats();
  const matchingChats = [];

  for (const chatId of Object.keys(chats)) {
    try {
      const member = await bot.api.getChatMember(chatId, userId);
      if (["administrator", "creator"].includes(member.status))
        matchingChats.push(chatId);
    } catch (error) {
      console.error(`Error checking admin status for chat ${chatId}:`, error);
      sendLogToChannel(`Error checking admin status: ${error}`, {
        chatId,
      });
    }
  }

  return matchingChats;
}

export async function patchChatSettings(
  ctx: Context,
  chatId: string,
  updateData: object,
  successMessage: string = "✅ Update successful!",
  errorMessage: string = "❌ Update failed. Please try again later."
) {
  const messageRestart = "Do /start if you want to do something else.";

  try {
    const response = await fetch(`${process.env.CHATS_API_URL}/${chatId}`, {
      method: "PATCH",
      body: JSON.stringify(updateData),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CHATS_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error("Update failed:", data);
      await ctx.reply(errorMessage + (data.message ? `: ${data.message}` : ""));
      return false;
    }

    actionStore.deletePendingAction(ctx.from?.id!);
    await ctx.reply(`${successMessage}\n\n${messageRestart}`);
    return true;
  } catch (error) {
    console.error("Update error:", error);
    await ctx.reply(`${errorMessage}\n\n${messageRestart}`);
    sendLogToChannel(`Update error: ${error} Message: ${errorMessage}`, {
      chatId,
    });
    return false;
  }
}

export async function mergeThreshold(chatId: string, newThreshold: Threshold) {
  const chatData = await fetchChatData(chatId);
  const thresholds = chatData?.settings?.thresholds ?? [];
  const filteredThresholds = thresholds.filter(
    (t: Threshold) =>
      t?.threshold !== undefined && t.threshold !== newThreshold.threshold
  );
  return [...filteredThresholds, newThreshold];
}
