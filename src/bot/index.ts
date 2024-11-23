import { Bot, InlineKeyboard, type Context } from "grammy";
import { getAddress, isAddress } from "viem";
import { getPools } from "../helpers/queries/pools";
import client from "../helpers/client";
import { PendingAction } from "../helpers/types";
import { fetchChatData } from "../helpers/utils";
// import { addAgentUserReply } from "../agents/index";
import {
  handleSettingsCallback,
  handleChatEditCallback,
  handleEditSettingsCallback,
  handleMediaCallback,
  handleSetupToken,
  handleRemoveWebhook,
  handleRemoveMedia,
} from "./callbacks";
import {
  getMatchingChats,
  updateChatSettings,
  sendLogToChannel,
  sendMessageToChat,
} from "../helpers/bot";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN must be set in the environment.");
  process.exit(1);
}

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

const pendingActions = new Map<number, PendingAction>();

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
  // addAgentUserReply(ctx);

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
      case "emojiStep":
        return handleEmojiStepUpdate(ctx, pendingAction.chatId);
      case "media":
        return handleMediaMessage(ctx, pendingAction.chatId);
    }
  }
});

async function handleStartCommand(ctx: Context) {
  if (ctx.chat?.type !== "private") {
    const button = new InlineKeyboard().url(
      "Click Me",
      `https://t.me/${ctx.me.username}`
    );

    return ctx.reply(
      "⬇️ Click the button below to proceed the setup in private chat!",
      {
        reply_markup: button,
      }
    );
  }

  const mainMenu = new InlineKeyboard()
    .url(
      "➕ Add me to your group",
      `https://t.me/${ctx.me.username}?startgroup=true`
    )
    .row()
    .text("⚙️ Settings", "settings");

  return ctx.reply(
    `Welcome to Fungibles Bot!

To get started, add me to your group and configure token tracking settings!

✨ Unique Features:
• Custom ERC20i features
• Buyer status indicator

💎 Built by ERC20i bulls, for the community:
• 100% free and open-source
    
[Website](https://fungibles.xyz) | [Telegram](https://t.me/fungibles_ERC20i) | [Suggestions](https://fungibles.canny.io/suggestions) | [Support Us](https://app.safe.global/balances?safe=base:0x45083345B7E20d9916dDa046344Ec518bf9e21D0)
    `,
    {
      reply_markup: mainMenu,
      parse_mode: "Markdown",
      link_preview_options: {
        is_disabled: true,
      },
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

  sendLogToChannel(`Updated status: ${update.new_chat_member.status}`, {
    type: "log",
  });
  switch (update.new_chat_member.status) {
    case "member":
    case "administrator":
      try {
        await sendMessageToChat(
          update.chat.id.toString(),
          `👋 Hey, I am FungiblesBot, your favorite ERC20i bot!`
        );
        sendLogToChannel(
          `Chat ${update.chat.id} added the bot to their group`,
          {
            type: "log",
          }
        );
        const response = await fetch(process.env.CHATS_API_URL!, {
          method: "POST",
          body: JSON.stringify({ id: update.chat.id.toString() }),
          headers: {
            Authorization: `Bearer ${process.env.CHATS_API_TOKEN}`,
          },
        });
        if (!response.ok) {
          const errorMessage = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorMessage}`
          );
        }
      } catch (error) {
        console.error("Failed to register chat:", error);
        sendLogToChannel(`Failed to register chat: ${error}`, {
          chatId: update.chat.id,
        });
      }
      break;
    case "left":
    case "kicked":
      try {
        sendLogToChannel(
          `Chat ${update.chat.id} removed the bot from their group`,
          {
            type: "log",
          }
        );
        const response = await fetch(
          `${process.env.CHATS_API_URL}/${update.chat.id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${process.env.CHATS_API_TOKEN}`,
            },
          }
        );
        if (!response.ok) {
          const errorMessage = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorMessage}`
          );
        }
      } catch (error) {
        console.error("Failed to delete chat:", error);
        sendLogToChannel(`Failed to delete chat: ${error}`, {
          chatId: update.chat.id,
        });
      }
      break;
  }
}
async function handleEmojiStepUpdate(ctx: Context, chatId: string) {
  const emojiStepAmount = ctx.message?.text?.trim() ?? "";

  if (!/^\d+(\.\d+)?$/.exec(emojiStepAmount)) {
    return ctx.reply("❌ Please provide a valid number in USD (e.g., 100).", {
      reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
    });
  }

  return updateChatSettings(
    ctx,
    pendingActions,
    chatId,
    { settings: { emojiStepAmount } },
    "✅ Emoji step amount updated successfully!",
    "❌ Failed to update emoji step amount"
  );
}
