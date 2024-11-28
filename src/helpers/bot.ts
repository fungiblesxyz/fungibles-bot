import { InputFile, Context } from "grammy";
import { bot, systemBot } from "../bot";
import { fetchChats } from "./utils";
import { PendingAction } from "./types";

export async function sendMessageToChat(
  chatId: string,
  message: string,
  threadId?: number
) {
  try {
    return await bot.api.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      link_preview_options: {
        is_disabled: true,
      },
      message_thread_id: threadId,
    });
  } catch (error) {
    console.error(`Failed to send message to chat ${chatId}:`, error);
    sendLogToChannel(`Failed to send message: ${error}`, {
      chatId,
    });
  }
}

export async function sendMediaToChat(
  chatId: string,
  media: Buffer | string,
  type: "photo" | "video" | "animation",
  message: string,
  threadId?: number
) {
  try {
    const mediaSource =
      typeof media === "string" ? media : new InputFile(media);

    switch (type) {
      case "photo":
        return await bot.api.sendPhoto(chatId, mediaSource, {
          caption: message,
          parse_mode: "Markdown",
          message_thread_id: threadId,
        });
      case "video":
        return await bot.api.sendVideo(chatId, mediaSource, {
          caption: message,
          parse_mode: "Markdown",
          message_thread_id: threadId,
        });
      case "animation":
        return await bot.api.sendAnimation(chatId, mediaSource, {
          caption: message,
          parse_mode: "Markdown",
          message_thread_id: threadId,
        });
    }
  } catch (error) {
    console.error(`Failed to send media to chat ${chatId}:`, error);
    sendLogToChannel(`Failed to send media: ${error}`, {
      chatId,
    });
    // Fallback to text-only message
    return sendMessageToChat(chatId, message);
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
      sendLogToChannel(`Error checking admin status: ${error}`, {
        chatId,
      });
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

    pendingActions.delete(ctx.from?.id!);
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

export async function sendLogToChannel(
  message: string,
  options: {
    chatId?: string | number;
    type?: "error" | "log";
  } = {}
) {
  try {
    const prefix = process.env.NODE_ENV === "test" ? "[TEST] " : "";
    const chatInfo = options.chatId ? `[Chat: ${options.chatId}] ` : "";
    const emoji = !options.type ? "🚨" : "📝";

    // Escape special Markdown characters
    const escapedMessage = message.replace(
      /([_*\[\]()~`>#+\-=|{}.!])/g,
      "\\$1"
    );

    await systemBot.api.sendMessage(
      "-1002420548293",
      `${prefix}${chatInfo}${emoji} ${
        !options.type ? "Error Log:" : "Log:"
      }\n${escapedMessage}`,
      {
        parse_mode: "Markdown",
        message_thread_id: 2,
      }
    );
  } catch (error) {
    console.error("Failed to send log to channel:", error);
  }
}
