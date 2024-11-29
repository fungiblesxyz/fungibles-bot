import { Bot, Context, InlineKeyboard } from "grammy";
import { ChatEntry, Threshold } from "../helpers/types";
import { sendLogToChannel } from "../helpers/bot";
import { patchChatSettings } from "./utils";
import { fetchChatData } from "../helpers/utils";

export async function handleShowGroupList(
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
      const chatData = await fetchChatData(chatId);
      if (!chatData?.info?.id) {
        chatsMenu.text(chatName, `chat-setup#${chatId}`).row();
      } else {
        chatsMenu.text(chatName, `chat-settings#${chatId}`).row();
      }
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

export async function showChatSettings(ctx: Context, chatData: ChatEntry) {
  ctx.editMessageText(
    `
Select an action:`,
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard()
        .text(`✏️ Edit token address (${chatData.info.symbol})`, `chat-setup`)
        .row()
        .text(
          `Emoji: ${chatData.settings?.emoji ?? "Not set"}`,
          `chat-set_emoji`
        )
        .row()
        .text(`🖼 Manage Buy Media`, `chat-thresholds`)
        .row()
        .text(
          `📢 Min Alert Amount: $${chatData.settings?.minBuyAmount ?? "0"}`,
          `chat-set_minBuy`
        )
        .row()
        .text(
          `📶 Emoji Step Amount: $${chatData.settings?.emojiStepAmount ?? "0"}`,
          `chat-set_emojiStep`
        )
        .row()
        .text("Cancel", "cancel"),
    }
  );
}

export async function handleRemoveMedia(ctx: Context, chatId: string) {
  const result = await patchChatSettings(
    ctx,
    chatId,
    {
      settings: {
        thresholds: null,
      },
    },
    "✅ Media removed successfully!",
    "❌ Failed to remove media"
  );
  try {
    await ctx.deleteMessage();
  } catch (error) {
    console.error("Failed to delete message:", error);
  }
  return result;
}

export async function showThresholds(ctx: Context, chatId: string) {
  const chatData = await fetchChatData(chatId);
  const keyboard = new InlineKeyboard();

  let messageText = "🎯 Thresholds\n\n";

  if (chatData?.settings?.thresholds?.length) {
    chatData.settings.thresholds.forEach((t: Threshold, index: number) => {
      keyboard.text(`$${t.threshold}`, `chat-threshold_${index}`).row();
    });
    messageText += "\n";
  }

  keyboard.text("➕ Add Threshold", `chat-set_threshold-amount`).row();
  keyboard.text("Cancel", "cancel");

  return ctx.reply(messageText, {
    reply_markup: keyboard,
  });
}

export async function showThreshold(
  ctx: Context,
  chatId: string,
  index: string
) {
  const chatData = await fetchChatData(chatId);
  const threshold = chatData.settings.thresholds[index];

  const keyboard = new InlineKeyboard();

  if (threshold.customWebhookUrl) {
    keyboard.text("❌ Remove URL", `chat-threshold-remove_${index}`);
  } else if (threshold.fileId) {
    keyboard.text("❌ Remove Media", `chat-threshold-remove_${index}`);
  }

  keyboard.text("Cancel", "cancel");

  try {
    if (threshold.fileId) {
      if (threshold.type === "photo") {
        await ctx.replyWithPhoto(threshold.fileId, {
          reply_markup: keyboard,
        });
      } else if (threshold.type === "video") {
        await ctx.replyWithVideo(threshold.fileId, {
          reply_markup: keyboard,
        });
      } else if (threshold.type === "animation") {
        await ctx.replyWithAnimation(threshold.fileId, {
          reply_markup: keyboard,
        });
      }
    } else {
      await ctx.reply(`Current Webhook URL: ${threshold.customWebhookUrl}\n`, {
        link_preview_options: {
          is_disabled: true,
        },
        reply_markup: keyboard,
      });
    }

    await ctx.deleteMessage();
  } catch (error) {
    console.error("Failed to reply:", error);
  }
}

export async function showThresholdSetup(ctx: Context, amount: string) {
  const keyboard = new InlineKeyboard();
  keyboard
    .text("➕ Add Media (Image/Video)", `chat-set_threshold-media_${amount}`)
    .row()
    .text("🔗 Set Custom Webhook", `chat-set_threshold-webhook_${amount}`)
    .row();

  return ctx.reply("Select an option:", { reply_markup: keyboard });
}

export async function handleRemoveThreshold(
  ctx: Context,
  chatId: string,
  index: string
) {
  const chatData = await fetchChatData(chatId);
  const thresholds = chatData.settings.thresholds.filter(
    (_: Threshold, i: number) => i !== parseInt(index)
  );

  return patchChatSettings(
    ctx,
    chatId,
    { settings: { thresholds } },
    "✅ Threshold removed successfully!",
    "❌ Failed to remove threshold"
  );
}
