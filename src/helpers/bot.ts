import { InputFile } from "grammy";
import { bot, systemBot } from "../bot";
import { NODE_ENV, SYSTEM_CHAT_ID, SYSTEM_THREAD_ID } from "../config";

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

export async function sendLogToChannel(
  message: string,
  options: {
    chatId?: string | number;
    type?: "error" | "log";
  } = {}
) {
  try {
    const prefix = NODE_ENV === "test" ? "[TEST] " : "";
    const chatInfo = options.chatId ? `[Chat: ${options.chatId}] ` : "";
    const emoji = !options.type ? "🚨" : "📝";

    // Escape special Markdown characters
    const escapedMessage = message.replace(
      /([_*\[\]()~`>#+\-=|{}.!])/g,
      "\\$1"
    );

    await systemBot.api.sendMessage(
      SYSTEM_CHAT_ID,
      `${prefix}${chatInfo}${emoji} ${
        !options.type ? "Error Log:" : "Log:"
      }\n${escapedMessage}`,
      {
        parse_mode: "Markdown",
        message_thread_id: SYSTEM_THREAD_ID,
      }
    );
  } catch (error) {
    console.error("Failed to send log to channel:", error);
  }
}
