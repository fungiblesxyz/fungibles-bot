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
        .text(
          `✏️ Edit token address (${chatData.info.symbol})`,
          `chat-set_token`
        )
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

// export async function showMediaSettings(
//   ctx: Context,
//   chatId: string,
//   chatData: ChatEntry
// ) {
//   const webhookUrl = chatData.settings?.customWebhookUrl;
//   const hasMedia = chatData.settings?.thresholds?.[0];

//   let messageText = " ";

//   if (webhookUrl) {
//     messageText += `Current URL: ${webhookUrl}\n`;
//   }
//   if (!hasMedia && !webhookUrl) {
//     messageText += "Choose an option:";
//   }

//   const keyboard = new InlineKeyboard();

//   if (!webhookUrl && !hasMedia) {
//     keyboard
//       .text("➕ Add Media (Image/Video)", `chat-set_media`)
//       .row()
//       .text("🔗 Set Custom Webhook", `chat-set_imageWebhook`)
//       .row();
//   } else if (webhookUrl) {
//     keyboard.text("❌ Remove URL", `chat-remove_webhook`);
//   } else if (hasMedia) {
//     keyboard.text("❌ Remove Media", `chat-remove_media`);
//   }

//   keyboard.text("Cancel", "cancel");

//   if (hasMedia) {
//     if (hasMedia.type === "photo") {
//       await ctx.replyWithPhoto(hasMedia.fileId, {
//         caption: messageText,
//         reply_markup: keyboard,
//       });
//     } else if (hasMedia.type === "video") {
//       await ctx.replyWithVideo(hasMedia.fileId, {
//         caption: messageText,
//         reply_markup: keyboard,
//       });
//     } else if (hasMedia.type === "animation") {
//       await ctx.replyWithAnimation(hasMedia.fileId, {
//         caption: messageText,
//         reply_markup: keyboard,
//       });
//     }
//     try {
//       await ctx.deleteMessage();
//     } catch (error) {
//       console.error("Failed to delete message:", error);
//     }
//   } else {
//     try {
//       await ctx.editMessageText(messageText, {
//         link_preview_options: {
//           is_disabled: true,
//         },
//         reply_markup: keyboard,
//       });
//     } catch (error) {
//       console.error("Failed to edit message:", error);
//     }
//   }
// }

// export async function handleRemoveWebhook(ctx: Context, chatId: string) {
//   const result = await patchChatSettings(
//     ctx,
//     chatId,
//     {
//       settings: {
//         customWebhookUrl: null,
//       },
//     },
//     "✅ Webhook URL removed successfully!",
//     "❌ Failed to remove webhook URL"
//   );
//   try {
//     await ctx.deleteMessage();
//   } catch (error) {
//     console.error("Failed to delete message:", error);
//   }
//   return result;
// }

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
    chatData.settings.thresholds.forEach((t: Threshold) => {
      keyboard.text(`$${t.threshold}`, `a`).row();
    });
    messageText += "\n";
  }

  keyboard.text("➕ Add Threshold", `chat-set_threshold-amount`).row();
  keyboard.text("Cancel", "cancel");

  return ctx.reply(messageText, {
    reply_markup: keyboard,
  });
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
