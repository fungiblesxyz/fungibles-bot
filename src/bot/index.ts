import { Bot, InlineKeyboard, type Context, InputFile } from "grammy";
import { getAddress, isAddress } from "viem";
import { getPools } from "./pools";
import client from "../client";
import {
  handleSettingsCallback,
  handleChatEditCallback,
  handleChatCallback,
  handleMediaCallback,
} from "./callbacks";
import { PendingAction } from "../types";
import { fetchChats } from "../utils";
require("dotenv").config();

// async function test() {
//   const tokenData = await getPools(
//     "0x7d9CE55D54FF3FEddb611fC63fF63ec01F26D15F",
//     client
//   );
//   console.log("🚀 ~ getAddressConversation ~ tokenData:", tokenData);
// }

// test();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN must be set in the environment.");
  process.exit(1);
}

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

const pendingActions = new Map<number, PendingAction>();

// Add error handling for bot startup
try {
  bot.start().catch((err) => {
    if (err.error_code === 409) {
      console.warn("Warning: Another bot instance may be running");
    } else {
      console.error("Bot startup error:", err);
    }
  });
} catch (err) {
  console.error("Failed to start bot:", err);
}

bot.command("start", handleStartCommand);

bot.on("callback_query:data", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;

  if (callbackData === "settings") {
    const matchingChats = await getMatchingChats(bot, ctx.from.id);
    return handleSettingsCallback(ctx, bot, matchingChats);
  }

  if (callbackData === "cancel") {
    pendingActions.delete(ctx.from.id);
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
    return handleChatCallback(ctx, chatId, fetchChatData, pendingActions);
  }

  if (callbackData.startsWith("chat-media_")) {
    const chatId = callbackData.replace("chat-media_", "");
    return handleMediaCallback(ctx, chatId);
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

async function getMatchingChats(bot: Bot, userId: number) {
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

async function fetchChatData(chatId: string) {
  return fetch(`${process.env.CHATS_API_URL}/${chatId}`)
    .then((res) => res.json())
    .then((json) => json.data);
}

async function handleTokenUpdate(ctx: Context, chatId: string) {
  const text = ctx.message?.text?.trim().toLowerCase() ?? "";

  if (!isAddress(text)) {
    return ctx.reply("❌ Invalid token address", {
      reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
    });
  }

  const address = getAddress(text);

  try {
    const tokenData = await getPools(address, client);

    if (!tokenData) {
      return ctx.reply(
        "❌ No pools found for this token. Please create a Uniswap pool first!",
        {
          reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
        }
      );
    }

    const response = await fetch(`${process.env.CHATS_API_URL}/${chatId}`, {
      method: "PATCH",
      body: JSON.stringify({ ...tokenData }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Token update failed:", data);
      await ctx.reply(
        "❌ Failed to save token address: " + (data.message || "Unknown error")
      );
      return;
    }

    pendingActions.delete(ctx.from?.id!);
    await ctx.reply("✅ Token address saved successfully!");
  } catch (error) {
    console.error("❌ Token update error:", error);
    await ctx.reply("❌ Failed to save token address. Please try again later.");
    return;
  }
}

async function handleEmojiUpdate(ctx: Context, chatId: string) {
  const emoji = ctx.message?.text?.trim() ?? "";

  try {
    const response = await fetch(`${process.env.CHATS_API_URL}/${chatId}`, {
      method: "PATCH",
      body: JSON.stringify({ settings: { emoji } }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await ctx.reply("❌ Failed to update emoji");
      return;
    }

    pendingActions.delete(ctx.from?.id!);
    await ctx.reply("✅ Emoji updated successfully!");
  } catch (error) {
    console.error("❌ Emoji update error:", error);
    await ctx.reply("❌ Failed to update emoji. Please try again later.");
  }
}

async function handleImageWebhookUpdate(ctx: Context, chatId: string) {
  const imageWebhookUrl = ctx.message?.text?.trim() ?? "";

  // Basic URL validation
  if (!/^https?:\/\/.+/i.exec(imageWebhookUrl)) {
    return ctx.reply(
      "❌ Please provide a valid image URL starting with http:// or https://",
      {
        reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
      }
    );
  }

  try {
    const response = await fetch(`${process.env.CHATS_API_URL}/${chatId}`, {
      method: "PATCH",
      body: JSON.stringify({ settings: { imageWebhookUrl } }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await ctx.reply("❌ Failed to update image URL");
      return;
    }

    pendingActions.delete(ctx.from?.id!);
    await ctx.reply("✅ Image URL updated successfully!");
  } catch (error) {
    console.error("❌ Image URL update error:", error);
    await ctx.reply("❌ Failed to update image URL. Please try again later.");
  }
}

async function handleMinBuyUpdate(ctx: Context, chatId: string) {
  const minBuyAmount = ctx.message?.text?.trim() ?? "";

  if (!/^\d+(\.\d+)?$/.exec(minBuyAmount)) {
    return ctx.reply("❌ Please provide a valid number in USD (e.g., 100).", {
      reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
    });
  }

  try {
    const response = await fetch(`${process.env.CHATS_API_URL}/${chatId}`, {
      method: "PATCH",
      body: JSON.stringify({ settings: { minBuyAmount } }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await ctx.reply("❌ Failed to update minimum buy amount");
      return;
    }

    pendingActions.delete(ctx.from?.id!);
    await ctx.reply("✅ Minimum buy amount updated successfully!");
  } catch (error) {
    console.error("❌ Minimum buy amount update error:", error);
    await ctx.reply(
      "❌ Failed to update minimum buy amount. Please try again later."
    );
  }
}

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
    "👋 Hey! I'm a token tracking bot that helps you monitor token activities in your groups!\n\n" +
      "ℹ️ I can track token transactions and provide useful commands\n" +
      "ℹ️ I'm completely ad-free!\n\n" +
      "To get started, add me to your group and configure token tracking settings.",
    {
      reply_markup: mainMenu,
    }
  );
}

async function handleMediaMessage(ctx: Context, chatId: string) {
  let mediaFileId: string | undefined;
  let mediaType: "photo" | "video" | "animation" | undefined;

  // Handle forwarded message with media
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

  try {
    const response = await fetch(`${process.env.CHATS_API_URL}/${chatId}`, {
      method: "PATCH",
      body: JSON.stringify({
        settings: {
          thresholds: [
            {
              threshold: 0,
              fileId: mediaFileId,
              type: mediaType,
            },
          ],
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await ctx.reply("❌ Failed to save media");
      return;
    }

    pendingActions.delete(ctx.from?.id!);

    await ctx.reply(`✅ Media saved successfully!`);
  } catch (error) {
    console.error("Error saving media:", error);
    await ctx.reply("❌ Failed to save media. Please try again.");
  }
}

async function handleChatMemberUpdate(ctx: Context) {
  const update = ctx.myChatMember;
  if (!update) return;

  switch (update.new_chat_member.status) {
    case "member":
    case "administrator":
      await fetch(process.env.CHATS_API_URL!, {
        method: "POST",
        body: JSON.stringify({ id: update.chat.id }),
      });
      return console.log("Bot was added to group");
    case "left":
      await fetch(`${process.env.CHATS_API_URL}/${update.chat.id}`, {
        method: "DELETE",
      });
      return console.log("Removed from group");
  }
}

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
