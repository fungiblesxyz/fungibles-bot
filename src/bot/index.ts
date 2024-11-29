import { Bot } from "grammy";
import { actionStore } from "./actions";
import { getMatchingChats } from "./utils";
import { handleRouteCallback } from "./router";
import { handleChatMemberUpdate } from "./triggers";
import { handleStartCommand } from "./commands";
import { handleShowGroupList } from "./callbacks";
import { handleMessageSubmission } from "./submissions";
import { TELEGRAM_BOT_TOKEN, TELEGRAM_SYSTEM_BOT_TOKEN } from "../config";

export const bot = new Bot(TELEGRAM_BOT_TOKEN);
export const systemBot = new Bot(TELEGRAM_SYSTEM_BOT_TOKEN);

bot.command("start", handleStartCommand);

bot.on("callback_query:data", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;

  if (callbackData === "settings") {
    const matchingChats = await getMatchingChats(ctx.from.id);
    return handleShowGroupList(ctx, bot, matchingChats);
  }

  if (callbackData === "cancel") {
    actionStore.deletePendingAction(ctx.from.id);
    if (!ctx.message) {
      await ctx.deleteMessage();
      return ctx.reply(
        "✔️ Operation cancelled!\n\nDo /start if you want to do something else."
      );
    }
    return ctx.editMessageText(
      "✔️ Operation cancelled!\n\nDo /start if you want to do something else."
    );
  }

  return handleRouteCallback(ctx);
});

bot.on("my_chat_member", (ctx) => {
  handleChatMemberUpdate(ctx);
});

bot.on("message", async (ctx) => {
  handleMessageSubmission(ctx);
});
