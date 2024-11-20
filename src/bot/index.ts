import { Bot, InlineKeyboard, type Context } from "grammy";
import { getAddress, isAddress } from "viem";
import { getPools } from "./pools";
import client from "../client";
import {
  handleSettingsCallback,
  handleChatEditCallback,
  handleEditSettingsCallback,
  handleMediaCallback,
  handleSetupToken,
  handleRemoveWebhook,
  handleRemoveMedia,
} from "./callbacks";
import { PendingAction } from "../types";
import { fetchChatData } from "../helpers/utils";
import {
  getMatchingChats,
  updateChatSettings,
  sendLogToChannel,
} from "../helpers/bot";

require("dotenv").config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN must be set in the environment.");
  process.exit(1);
}

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

const pendingActions = new Map<number, PendingAction>();

// Bot startup
bot.start().catch((err) => {
  if (err.error_code === 409) {
    console.warn("Warning: Another bot instance may be running");
  } else {
    console.error("Bot startup error:", err);
  }
});

bot.command("start", handleStartCommand);

bot.on("callback_query:data", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;

  if (callbackData === "settings") {
    const matchingChats = await getMatchingChats(ctx.from.id);
    return handleSettingsCallback(ctx, bot, matchingChats);
  }

  if (callbackData === "cancel") {
    pendingActions.delete(ctx.from.id);
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

  if (callbackData.startsWith("chat-edit_")) {
    const [chatId] = callbackData.replace("chat-edit_", "").split("_");
    return handleChatEditCallback(ctx, chatId, pendingActions);
  }

  if (callbackData.startsWith("chat_")) {
    const chatId = callbackData.replace("chat_", "");
    const chatData = await fetchChatData(chatId);
    if (!chatData?.info?.id) {
      await handleSetupToken(ctx, chatId, pendingActions);
      return;
    }
    return handleEditSettingsCallback(ctx, chatData);
  }

  if (callbackData.startsWith("chat-media_")) {
    const chatId = callbackData.replace("chat-media_", "");
    const chatData = await fetchChatData(chatId);
    return handleMediaCallback(ctx, chatId, chatData);
  }

  if (callbackData.startsWith("chat-remove_")) {
    const [chatId, type] = callbackData.replace("chat-remove_", "").split("_");

    if (type === "webhook") {
      return handleRemoveWebhook(ctx, chatId);
    } else if (type === "media") {
      return handleRemoveMedia(ctx, chatId);
    }
  }

  console.log("Unknown button event with payload:", callbackData);
  return ctx.answerCallbackQuery();
});

bot.on("my_chat_member", handleChatMemberUpdate);
bot.on("message", async (ctx) => {
  const pendingAction = pendingActions.get(ctx.from.id);

  if (pendingAction) {
    switch (pendingAction.action) {
      case "token":
        return handleTokenUpdate(ctx, pendingAction.chatId);
      case "emoji":
        return handleEmojiUpdate(ctx, pendingAction.chatId);
      case "imageWebhook":
        return handleImageWebhookUpdate(ctx, pendingAction.chatId);
      case "minBuy":
        return handleMinBuyUpdate(ctx, pendingAction.chatId);
      case "media":
        return handleMediaMessage(ctx, pendingAction.chatId);
    }
  }
});

async function handleStartCommand(ctx: Context) {
  if (ctx.chat?.type !== "private") {
    return ctx.reply("This command can only be used in group private chats.");
  }

  const mainMenu = new InlineKeyboard()
    .url(
      "➕ Add me to your group",
      `https://t.me/${ctx.me.username}?startgroup=true`
    )
    .row()
    .text("⚙️ Settings", "settings");

  return ctx.reply(
    `Welcome to Fungibles Bot - Your Ultimate ERC20i Token Bot!

✨ Unique Features:
• Specialized tracking for ERC20i tokens
• Diamond Hands Indicator for smart buys

💎 Built by ERC20i bulls, for the community:
• 100% Ad-free
• Free and open-source

🌐 Visit: fungibles.xyz
💬 Join our community: @fungibles_ERC20i

To get started, add me to your group and configure token tracking settings!`,
    {
      reply_markup: mainMenu,
    }
  );
}

async function handleTokenUpdate(ctx: Context, chatId: string) {
  const text = ctx.message?.text?.trim().toLowerCase() ?? "";

  if (!isAddress(text)) {
    return ctx.reply("❌ Invalid token address", {
      reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
    });
  }

  const address = getAddress(text);
  const tokenData = await getPools(address, client);

  if (!tokenData) {
    return ctx.reply(
      "❌ No pools found for this token. Please create a Uniswap pool first!",
      {
        reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
      }
    );
  }

  return updateChatSettings(
    ctx,
    pendingActions,
    chatId,
    tokenData,
    "✅ Token address saved successfully!",
    "❌ Failed to save token address"
  );
}

async function handleEmojiUpdate(ctx: Context, chatId: string) {
  const emoji = ctx.message?.text?.trim() ?? "";
  return updateChatSettings(
    ctx,
    pendingActions,
    chatId,
    { settings: { emoji } },
    "✅ Emoji updated successfully!",
    "❌ Failed to update emoji"
  );
}

async function handleImageWebhookUpdate(ctx: Context, chatId: string) {
  const imageWebhookUrl = ctx.message?.text?.trim() ?? "";

  if (!/^https?:\/\/.+/i.exec(imageWebhookUrl)) {
    return ctx.reply(
      "❌ Please provide a valid image URL starting with http:// or https://",
      {
        reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
      }
    );
  }

  return updateChatSettings(
    ctx,
    pendingActions,
    chatId,
    { settings: { imageWebhookUrl } },
    "✅ Image URL updated successfully!",
    "❌ Failed to update image URL"
  );
}

async function handleMinBuyUpdate(ctx: Context, chatId: string) {
  const minBuyAmount = ctx.message?.text?.trim() ?? "";

  if (!/^\d+(\.\d+)?$/.exec(minBuyAmount)) {
    return ctx.reply("❌ Please provide a valid number in USD (e.g., 100).", {
      reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
    });
  }

  return updateChatSettings(
    ctx,
    pendingActions,
    chatId,
    { settings: { minBuyAmount } },
    "✅ Minimum buy amount updated successfully!",
    "❌ Failed to update minimum buy amount"
  );
}

async function handleMediaMessage(ctx: Context, chatId: string) {
  let mediaFileId: string | undefined;
  let mediaType: "photo" | "video" | "animation" | undefined;

  if (ctx.message?.photo) {
    mediaFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    mediaType = "photo";
  } else if (ctx.message?.animation) {
    mediaFileId = ctx.message.animation.file_id;
    mediaType = "animation";
  } else if (ctx.message?.video) {
    mediaFileId = ctx.message.video.file_id;
    mediaType = "video";
  } else if (ctx.message?.text?.startsWith("https://t.me/")) {
    mediaFileId = ctx.message.text;
  }

  if (!mediaFileId || !mediaType) {
    await ctx.reply("❌ Please send a valid image, video, GIF, or t.me link");
    return;
  }

  return updateChatSettings(
    ctx,
    pendingActions,
    chatId,
    {
      settings: {
        thresholds: [
          {
            threshold: 0,
            fileId: mediaFileId,
            type: mediaType,
          },
        ],
      },
    },
    "✅ Media saved successfully!",
    "❌ Failed to save media"
  );
}

async function handleChatMemberUpdate(ctx: Context) {
  const update = ctx.myChatMember;
  if (!update) return;

  switch (update.new_chat_member.status) {
    case "member":
    case "administrator":
      try {
        sendLogToChannel(`Chat ${update.chat.id} added the bot to their group`);
        const response = await fetch(process.env.CHATS_API_URL!, {
          method: "POST",
          body: JSON.stringify({ id: update.chat.id.toString() }),
        });
        if (!response.ok) {
          const errorMessage = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorMessage}`
          );
        }
      } catch (error) {
        console.error("Failed to register chat:", error);
        sendLogToChannel(`Failed to register chat: ${error}`, update.chat.id);
      }
      break;
    case "left":
      try {
        sendLogToChannel(
          `Chat ${update.chat.id} removed the bot from their group`
        );
        const response = await fetch(
          `${process.env.CHATS_API_URL}/${update.chat.id}`,
          {
            method: "DELETE",
          }
        );
        console.log("🚀 ~ handleChatMemberUpdate ~ response:", response);
        if (!response.ok) {
          const errorMessage = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorMessage}`
          );
        }
      } catch (error) {
        console.error("Failed to delete chat:", error);
        sendLogToChannel(`Failed to delete chat: ${error}`, update.chat.id);
      }
      break;
  }
}
