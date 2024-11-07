import { Bot, InlineKeyboard, type Context } from "grammy";
import { getAddress, isAddress } from "viem";
import { getPools } from "./pools";

require("dotenv").config();

// async function test() {
//   const Pools = await getPools("0x7d9CE55D54FF3FEddb611fC63fF63ec01F26D15F");

//   console.log("Uniswap Pools:", JSON.stringify(Pools, null, 2));
// }

// test();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN must be set in the environment.");
  process.exit(1);
}

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const pendingTokenAddresses = new Map<number, string>();

bot.start();
bot.command("start", handleStartCommand);

bot.on("callback_query:data", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;

  if (callbackData === "settings") {
    return handleSettingsCallback(ctx);
  }

  if (callbackData === "cancel") {
    pendingTokenAddresses.delete(ctx.from.id);
    return ctx.editMessageText(
      "✔️ Operation cancelled!\n\nDo /start if you want to do something else."
    );
  }

  if (callbackData.startsWith("chat-edit_")) {
    const chatId = callbackData.replace("chat-edit_", "");
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
  const pendingChatId = pendingTokenAddresses.get(ctx.from.id);

  if (pendingChatId) {
    return getAddressConversation(ctx, pendingChatId);
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

async function getAddressConversation(ctx: Context, chatId: string) {
  console.log("🚀 ~ getAddressConversation ~ chatId:", chatId);
  const text = ctx.message?.text?.trim().toLowerCase() ?? "";

  if (!isAddress(text)) {
    return ctx.reply("❌ Invalid token address", {
      reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
    });
  }

  const address = getAddress(text);

  try {
    const tokenData = await getPools(address);

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
      body: JSON.stringify({ ...tokenData, token: address }),
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

    pendingTokenAddresses.delete(ctx.from?.id!);
    await ctx.reply("✅ Token address saved successfully!");
  } catch (error) {
    console.error("❌ Token update error:", error);
    await ctx.reply("❌ Failed to save token address. Please try again later.");
    return;
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
  pendingTokenAddresses.set(ctx.from.id, chatId);
  await ctx.editMessageText("➡️ Send your token address", {
    reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
  });
}

function shortenAddress(address: string, includeLink = false): string {
  const shortened = `${address.slice(0, 6)}...${address.slice(-4)}`;
  return includeLink
    ? `[${shortened}](https://basescan.org/address/${address})`
    : shortened;
}

function formatPoolsInfo(pools: Record<string, string>): string {
  return Object.entries(pools)
    .map(([pool, value]) => `• ${pool}: ${shortenAddress(value, true)}`)
    .join("\n");
}

async function handleChatCallback(ctx: Context, chatId: string) {
  const chatData = await fetchChatData(chatId);
  if (!chatData?.token) {
    await handleChatEditCallback(ctx, chatId);
    return;
  }

  ctx.editMessageText(
    `
💎 Current Token Info:
• Symbol: ${chatData.info.symbol}
• Address: ${shortenAddress(chatData.token, true)}
${formatPoolsInfo(chatData.pools)}

Select an action:`,
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard()
        .text("✏️ Edit token address", `chat-edit_${chatId}`)
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
  console.log("🚀 ~ handleChatMemberUpdate ~ ctx:", ctx);
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
