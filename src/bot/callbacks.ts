import { Bot, Context, InlineKeyboard } from "grammy";
import { PendingAction, ActionType, ChatEntry } from "../helpers/types";
import { updateChatSettings, sendLogToChannel } from "../helpers/bot";

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
      sendLogToChannel(`Error fetching chat: ${error}`, {
        chatId,
      });
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
    emojiStep: "➡️ Send emoji step amount in USD (e.g., 100).",
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

export async function handleEditSettingsCallback(
  ctx: Context,
  chatData: ChatEntry
) {
  ctx.editMessageText(
    `
Select an action:`,
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard()
        .text(
          `✏️ Edit token address (${chatData.info.symbol})`,
          `chat-edit_${chatData.id}_token`
        )
        .row()
        .text(
          `Emoji: ${chatData.settings?.emoji ?? "Not set"}`,
          `chat-edit_${chatData.id}_emoji`
        )
        .row()
        .text(`🖼 Manage Buy Media`, `chat-media_${chatData.id}`)
        .row()
        .text(
          `📢 Min Alert Amount: $${chatData.settings?.minBuyAmount ?? "0"}`,
          `chat-edit_${chatData.id}_minBuy`
        )
        .row()
        .text(
          `📶 Emoji Step Amount: $${chatData.settings?.emojiStepAmount ?? "0"}`,
          `chat-edit_${chatData.id}_emojiStep`
        )
        .row()
        .text("Cancel", "cancel"),
    }
  );
}

export async function handleMediaCallback(
  ctx: Context,
  chatId: string,
  chatData: ChatEntry
) {
  const webhookUrl = chatData.settings?.imageWebhookUrl;
  const hasMedia = chatData.settings?.thresholds?.[0];

  let messageText = " ";

  if (webhookUrl) {
    messageText += `Current URL: ${webhookUrl}\n`;
  }
  if (!hasMedia && !webhookUrl) {
    messageText += "Choose an option:";
  }

  const keyboard = new InlineKeyboard();

  if (!webhookUrl && !hasMedia) {
    keyboard
      .text("➕ Add Media (Image/Video)", `chat-edit_${chatId}_media`)
      .row()
      .text("🔗 Set Webhook URL", `chat-edit_${chatId}_imageWebhook`)
      .row();
  } else if (webhookUrl) {
    keyboard.text("❌ Remove URL", `chat-remove_${chatId}_webhook`);
  } else if (hasMedia) {
    keyboard.text("❌ Remove Media", `chat-remove_${chatId}_media`);
  }

  keyboard.text("Cancel", "cancel");

  if (hasMedia) {
    if (hasMedia.type === "photo") {
      await ctx.replyWithPhoto(hasMedia.fileId, {
        caption: messageText,
        reply_markup: keyboard,
      });
    } else if (hasMedia.type === "video") {
      await ctx.replyWithVideo(hasMedia.fileId, {
        caption: messageText,
        reply_markup: keyboard,
      });
    } else if (hasMedia.type === "animation") {
      await ctx.replyWithAnimation(hasMedia.fileId, {
        caption: messageText,
        reply_markup: keyboard,
      });
    }
    await ctx.deleteMessage();
  } else {
    await ctx.editMessageText(messageText, {
      link_preview_options: {
        is_disabled: true,
      },
      reply_markup: keyboard,
    });
  }
}

export async function handleSetupToken(
  ctx: Context,
  chatId: string,
  pendingActions: Map<number, PendingAction>
) {
  if (!ctx.callbackQuery) return;

  const withModifiedCallback = `${ctx.callbackQuery.data}_token`;
  ctx.callbackQuery.data = withModifiedCallback;

  return handleChatEditCallback(ctx, chatId, pendingActions);
}

export async function handleRemoveWebhook(ctx: Context, chatId: string) {
  const result = await updateChatSettings(
    ctx,
    new Map(),
    chatId,
    {
      settings: {
        imageWebhookUrl: null,
      },
    },
    "✅ Webhook URL removed successfully!",
    "❌ Failed to remove webhook URL"
  );
  await ctx.deleteMessage();
  return result;
}

export async function handleRemoveMedia(ctx: Context, chatId: string) {
  const result = await updateChatSettings(
    ctx,
    new Map(),
    chatId,
    {
      settings: {
        thresholds: null,
      },
    },
    "✅ Media removed successfully!",
    "❌ Failed to remove media"
  );
  await ctx.deleteMessage();
  return result;
}
