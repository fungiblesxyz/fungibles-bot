import { InputFile, Context } from "grammy";
import { bot } from "../bot";
import { fetchChats } from "./utils";
import { PendingAction } from "../types";

export function sendMessageToChat(chatId: string, message: string) {
  return bot.api.sendMessage(chatId, message, {
    parse_mode: "Markdown",
  });
}

export function sendMediaToChat(
  chatId: string,
  media: Buffer | string,
  type: "photo" | "video" | "animation",
  message: string
) {
  const mediaSource = typeof media === "string" ? media : new InputFile(media);

  if (type === "photo") {
    return bot.api.sendPhoto(chatId, mediaSource, {
      caption: message,
      parse_mode: "Markdown",
    });
  }

  if (type === "video") {
    return bot.api.sendVideo(chatId, mediaSource, {
      caption: message,
      parse_mode: "Markdown",
    });
  }

  if (type === "animation") {
    return bot.api.sendAnimation(chatId, mediaSource, {
      caption: message,
      parse_mode: "Markdown",
    });
  }
}

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
    }
  }

  return matchingChats;
}

export async function updateChatSettings(
  ctx: Context,
  pendingActions: Map<number, PendingAction>,
  chatId: string,
  updateData: object,
  successMessage: string = "✅ Update successful!",
  errorMessage: string = "❌ Update failed. Please try again later."
) {
  try {
    const response = await fetch(`${process.env.CHATS_API_URL}/${chatId}`, {
      method: "PATCH",
      body: JSON.stringify(updateData),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error("Update failed:", data);
      await ctx.reply(errorMessage + (data.message ? `: ${data.message}` : ""));
      return false;
    }

    pendingActions.delete(ctx.from?.id!);
    await ctx.reply(successMessage);
    return true;
  } catch (error) {
    console.error("Update error:", error);
    await ctx.reply(errorMessage);
    return false;
  }
}
