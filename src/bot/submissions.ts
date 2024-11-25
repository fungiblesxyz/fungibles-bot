import { Context, InlineKeyboard } from "grammy";
import { isAddress, getAddress } from "viem";
import client from "../helpers/client";
import { getPools } from "../helpers/queries/pools";
import { patchChatSettings } from "./utils";
import { actionStore } from "./actions";

export async function handleMessageSubmission(ctx: Context) {
  if (!ctx.from) return;
  const pendingAction = actionStore.getPendingAction(ctx.from.id);

  if (!pendingAction) return;
  switch (pendingAction.action) {
    case "setup":
      return handleTokenAddressSubmission(ctx, pendingAction.chatId);
    case "emoji":
      return handleEmojiSubmission(ctx, pendingAction.chatId);
    case "imageWebhook":
      return handleWebhookUrlSubmission(ctx, pendingAction.chatId);
    case "minBuy":
      return handleMinBuyAmountSubmission(ctx, pendingAction.chatId);
    case "emojiStep":
      return handleEmojiStepAmountSubmission(ctx, pendingAction.chatId);
    case "media":
      return handleMediaSubmission(ctx, pendingAction.chatId);
  }
}

export async function handleTokenAddressSubmission(
  ctx: Context,
  chatId: string
) {
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

  return patchChatSettings(
    ctx,
    chatId,
    tokenData,
    "✅ Token address saved successfully!",
    "❌ Failed to save token address"
  );
}

export async function handleEmojiSubmission(ctx: Context, chatId: string) {
  const emoji = ctx.message?.text?.trim() ?? "";
  return patchChatSettings(
    ctx,
    chatId,
    { settings: { emoji } },
    "✅ Emoji updated successfully!",
    "❌ Failed to update emoji"
  );
}

export async function handleWebhookUrlSubmission(ctx: Context, chatId: string) {
  const customWebhookUrl = ctx.message?.text?.trim() ?? "";

  if (!/^https?:\/\/.+/i.exec(customWebhookUrl)) {
    return ctx.reply(
      "❌ Please provide a valid image URL starting with http:// or https://",
      {
        reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
      }
    );
  }

  return patchChatSettings(
    ctx,
    chatId,
    { settings: { customWebhookUrl } },
    "✅ Image URL updated successfully!",
    "❌ Failed to update image URL"
  );
}

export async function handleMinBuyAmountSubmission(
  ctx: Context,
  chatId: string
) {
  const minBuyAmount = ctx.message?.text?.trim() ?? "";

  if (!/^\d+(\.\d+)?$/.exec(minBuyAmount)) {
    return ctx.reply("❌ Please provide a valid number in USD (e.g., 100).", {
      reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
    });
  }

  return patchChatSettings(
    ctx,
    chatId,
    { settings: { minBuyAmount } },
    "✅ Minimum buy amount updated successfully!",
    "❌ Failed to update minimum buy amount"
  );
}

export async function handleMediaSubmission(ctx: Context, chatId: string) {
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

  return patchChatSettings(
    ctx,
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

export async function handleEmojiStepAmountSubmission(
  ctx: Context,
  chatId: string
) {
  const emojiStepAmount = ctx.message?.text?.trim() ?? "";

  if (!/^\d+(\.\d+)?$/.exec(emojiStepAmount)) {
    return ctx.reply("❌ Please provide a valid number in USD (e.g., 100).", {
      reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
    });
  }

  return patchChatSettings(
    ctx,
    chatId,
    { settings: { emojiStepAmount } },
    "✅ Emoji step amount updated successfully!",
    "❌ Failed to update emoji step amount"
  );
}
