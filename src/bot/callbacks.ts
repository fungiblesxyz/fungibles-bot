import { Bot, Context, InlineKeyboard } from "grammy";
import { shortenAddress } from "../utils";
import { PendingAction, ActionType } from "../types";

function formatPoolsInfo(pools: Record<string, string>): string {
  return Object.entries(pools)
    .map(([pool, value]) => `• ${pool}: ${shortenAddress(value, true)}`)
    .join("\n");
}

export async function handleSettingsCallback(
  ctx: Context,
  bot: Bot,
  matchingChats: string[]
) {
  if (!matchingChats.length) {
    await ctx.answerCallbackQuery({
      text: "❌ No groups added yet! Please add the bot to your group first",
      show_alert: true,
    });
    return;
  }

  const chatsMenu = new InlineKeyboard();

  for (const chatId of matchingChats) {
    try {
      const chat = await bot.api.getChat(chatId);
      const chatName = chat.title ?? "Unknown Chat";
      chatsMenu.text(chatName, `chat_${chatId}`).row();
    } catch (error) {
      console.error(`Error fetching chat ${chatId}:`, error);
    }
  }

  chatsMenu.text("Cancel", "cancel");

  await ctx.editMessageText("Select a group to configure:", {
    reply_markup: chatsMenu,
  });
}

export async function handleChatEditCallback(
  ctx: Context,
  chatId: string,
  pendingActions: Map<number, PendingAction>
) {
  if (!ctx.from) return;

  const [, , action] = ctx.callbackQuery?.data?.split("_") ?? [];

  const prompts: Record<ActionType, string> = {
    token: "➡️ Send your token address",
    emoji: "➡️ Send your preferred emoji",
    imageWebhook:
      "➡️ Send your image URL (must start with http:// or https://)",
    minBuy:
      "➡️ Send minimum buy amount in USD to trigger alerts (e.g., 100). Buys below this amount will be ignored.",
    media: "➡️ Send your image or video directly to this chat",
  };

  pendingActions.set(ctx.from.id, {
    chatId,
    action: action as ActionType,
    promptMessage: prompts[action as ActionType],
  });

  await ctx.editMessageText(prompts[action as ActionType], {
    reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
  });
}

export async function handleChatCallback(
  ctx: Context,
  chatId: string,
  fetchChatData: (chatId: string) => Promise<any>,
  pendingActions: Map<number, PendingAction>
) {
  const chatData = await fetchChatData(chatId);
  if (!chatData?.info.id) {
    await handleChatEditCallback(ctx, chatId, pendingActions);
    return;
  }

  ctx.editMessageText(
    `
💎 Current Token Info:
• Symbol: ${chatData.info.symbol}
• Address: ${shortenAddress(chatData.info.id, true)}
${formatPoolsInfo(chatData.pools)}

Select an action:`,
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard()
        .text("✏️ Edit token address", `chat-edit_${chatId}_token`)
        .row()
        .text(
          `Emoji: ${chatData.settings?.emoji ?? "Not set"}`,
          `chat-edit_${chatId}_emoji`
        )
        .row()
        .text(`🖼 Manage Buy Media`, `chat-media_${chatId}`)
        .row()
        .text(
          `💵 Min Buy Alert: $${chatData.settings?.minBuyAmount ?? "0"}`,
          `chat-edit_${chatId}_minBuy`
        )
        .row()
        .text("Cancel", "cancel"),
    }
  );
}

export async function handleMediaCallback(ctx: Context, chatId: string) {
  await ctx.editMessageText("🖼 Media Management\n\nChoose an option:", {
    reply_markup: new InlineKeyboard()
      .text("➕ Add Media (Image/Video)", `chat-edit_${chatId}_media`)
      .row()
      .text("🔗 Set Webhook URL", `chat-edit_${chatId}_imageWebhook`)
      .row()
      .text("Cancel", "cancel"),
  });
}
