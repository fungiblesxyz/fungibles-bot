import { Bot, InlineKeyboard, type Context, InputFile } from "grammy";
import { getAddress, isAddress } from "viem";
import { getPools } from "./pools";
import { shortenAddress } from "../utils";
import client from "../client";

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

// Define the action types once
type ActionType = "token" | "emoji" | "image";

// Replace the simple pending map with a more detailed structure
interface PendingAction {
  chatId: string;
  action: ActionType;
  promptMessage: string;
}
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
    return handleSettingsCallback(ctx);
  }

  if (callbackData === "cancel") {
    pendingActions.delete(ctx.from.id);
    return ctx.editMessageText(
      "✔️ Operation cancelled!\n\nDo /start if you want to do something else."
    );
  }

  if (callbackData.startsWith("chat-edit_")) {
    const [chatId] = callbackData.replace("chat-edit_", "").split("_");
    return handleChatEditCallback(ctx, chatId);
  }

  if (callbackData.startsWith("chat_")) {
    const chatId = callbackData.replace("chat_", "");
    return handleChatCallback(ctx, chatId);
  }

  console.log("Unknown button event with payload:", callbackData);
  return ctx.answerCallbackQuery();
});

bot.on("my_chat_member", handleChatMemberUpdate);
bot.on("message:text", async (ctx) => {
  const pendingAction = pendingActions.get(ctx.from.id);

  if (pendingAction) {
    switch (pendingAction.action) {
      case "token":
        return handleTokenUpdate(ctx, pendingAction.chatId);
      case "emoji":
        return handleEmojiUpdate(ctx, pendingAction.chatId);
      case "image":
        return handleImageUpdate(ctx, pendingAction.chatId);
    }
  }
});

async function getMatchingChats(bot: Bot, userId: number) {
  const chats = await fetchChats();
  const matchingChats = [];

  for (const chatId of chats) {
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

async function fetchChats() {
  return fetch(process.env.CHATS_API_URL!)
    .then((res) => res.json())
    .then((json) => Object.keys(json.data));
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

async function handleImageUpdate(ctx: Context, chatId: string) {
  const imageUrl = ctx.message?.text?.trim() ?? "";

  // Basic URL validation
  if (!imageUrl.match(/^https?:\/\/.+/i)) {
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
      body: JSON.stringify({ settings: { imageUrl } }),
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

async function handleSettingsCallback(ctx: Context) {
  if (!ctx.callbackQuery?.from?.id) return;

  const matchingChats = await getMatchingChats(bot, ctx.callbackQuery.from.id);
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

async function handleChatEditCallback(ctx: Context, chatId: string) {
  if (!ctx.from) return;

  const [, , action] = ctx.callbackQuery?.data?.split("_") ?? [];

  const prompts: Record<ActionType, string> = {
    token: "➡️ Send your token address",
    emoji: "➡️ Send your preferred emoji",
    image: "➡️ Send your image URL (must start with http:// or https://)",
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

function formatPoolsInfo(pools: Record<string, string>): string {
  return Object.entries(pools)
    .map(([pool, value]) => `• ${pool}: ${shortenAddress(value, true)}`)
    .join("\n");
}

async function handleChatCallback(ctx: Context, chatId: string) {
  const chatData = await fetchChatData(chatId);
  if (!chatData?.info.id) {
    await handleChatEditCallback(ctx, chatId);
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
        .text(
          `🖼 ${chatData.settings?.imageUrl ? "Change" : "Set"} Image URL`,
          `chat-edit_${chatId}_image`
        )
        .row()
        .text("Cancel", "cancel"),
    }
  );
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

export function sendImageToChat(
  chatId: string,
  image: Buffer,
  message: string
) {
  return bot.api.sendPhoto(chatId, new InputFile(image), {
    caption: message,
    parse_mode: "Markdown",
  });
}
