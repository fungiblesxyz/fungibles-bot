import { bot } from "@bot/helpers/bot";
import { actionStore } from "./actions";
import { getMatchingChats } from "./utils";
import { handleRouteCallback } from "./router";
import { handleChatMemberUpdate } from "./triggers";
import { handleStartCommand, handleBuyerStatusCommand } from "./commands";
import { handleShowGroupList } from "./callbacks";
import { handleMessageSubmission } from "./submissions";

bot.start().catch((err) => {
  if (err.error_code === 409) {
    console.warn("Warning: Another bot instance may be running");
  } else {
    console.error("Bot startup error:", err);
  }
});

bot.command("start", handleStartCommand);
bot.command("bstatus", handleBuyerStatusCommand);

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
