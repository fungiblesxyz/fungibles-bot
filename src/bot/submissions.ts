import { Context, InlineKeyboard } from "grammy";
import { isAddress, getAddress } from "viem";
import client from "../helpers/client";
import { getPools } from "../helpers/queries/pools";
import { patchChatSettings, mergeThreshold } from "./utils";
import { actionStore } from "./actions";
import { showThresholdSetup } from "./callbacks";
import { PendingAction } from "../helpers/types";
export async function handleMessageSubmission(ctx: Context) {
  if (!ctx.from) return;
  const pendingAction = actionStore.getPendingAction(ctx.from.id);

  if (!pendingAction) return;
  switch (pendingAction.action) {
    case "setup":
      return handleTokenAddressSubmission(ctx, pendingAction);
    case "emoji":
      return handleEmojiSubmission(ctx, pendingAction);
    case "minBuy":
      return handleMinBuyAmountSubmission(ctx, pendingAction);
    case "emojiStep":
      return handleEmojiStepAmountSubmission(ctx, pendingAction);
    case "thresholdAmount":
      return handleThresholdAmountSubmission(ctx, pendingAction);
    case "thresholdMedia":
      return handleThresholdMediaSubmission(ctx, pendingAction);
    case "thresholdWebhook":
      return handleThresholdWebhookUrlSubmission(ctx, pendingAction);
  }
}

export async function handleTokenAddressSubmission(
  ctx: Context,
  pendingAction: PendingAction
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
    pendingAction.chatId,
    tokenData,
    "✅ Token address saved successfully!",
    "❌ Failed to save token address"
  );
}

export async function handleEmojiSubmission(
  ctx: Context,
  pendingAction: PendingAction
) {
  const emoji = ctx.message?.text?.trim() ?? "";
  return patchChatSettings(
    ctx,
    pendingAction.chatId,
    { settings: { emoji } },
    "✅ Emoji updated successfully!",
    "❌ Failed to update emoji"
  );
}

export async function handleMinBuyAmountSubmission(
  ctx: Context,
  pendingAction: PendingAction
) {
  const minBuyAmount = ctx.message?.text?.trim() ?? "";

  if (!/^\d+(\.\d+)?$/.exec(minBuyAmount)) {
    return ctx.reply("❌ Please provide a valid number in USD (e.g., 100).", {
      reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
    });
  }

  return patchChatSettings(
    ctx,
    pendingAction.chatId,
    { settings: { minBuyAmount } },
    "✅ Minimum buy amount updated successfully!",
    "❌ Failed to update minimum buy amount"
  );
}

export async function handleEmojiStepAmountSubmission(
  ctx: Context,
  pendingAction: PendingAction
) {
  const emojiStepAmount = ctx.message?.text?.trim() ?? "";

  if (!/^\d+(\.\d+)?$/.exec(emojiStepAmount)) {
    return ctx.reply("❌ Please provide a valid number in USD (e.g., 100).", {
      reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
    });
  }

  return patchChatSettings(
    ctx,
    pendingAction.chatId,
    { settings: { emojiStepAmount } },
    "✅ Emoji step amount updated successfully!",
    "❌ Failed to update emoji step amount"
  );
}

export async function handleThresholdAmountSubmission(
  ctx: Context,
  pendingAction: PendingAction
) {
  const threshold = ctx.message?.text?.trim() ?? "";

  actionStore.deletePendingAction(ctx.from?.id!);
  return showThresholdSetup(ctx, threshold);
}

export async function handleThresholdWebhookUrlSubmission(
  ctx: Context,
  pendingAction: PendingAction
) {
  const customWebhookUrl = ctx.message?.text?.trim() ?? "";

  if (!/^https?:\/\/.+/i.exec(customWebhookUrl)) {
    return ctx.reply(
      "❌ Please provide a valid image URL starting with http:// or https://",
      {
        reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
      }
    );
  }

  const newThreshold = {
    threshold: Number(pendingAction.data),
    customWebhookUrl,
  };

  return patchChatSettings(
    ctx,
    pendingAction.chatId,
    {
      settings: {
        thresholds: await mergeThreshold(pendingAction.chatId, newThreshold),
      },
    },
    "✅ Webhook URL set successfully!",
    "❌ Failed to set webhook URL"
  );
}

export async function handleThresholdMediaSubmission(
  ctx: Context,
  pendingAction: PendingAction
) {
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

  const newThreshold = {
    threshold: Number(pendingAction.data),
    fileId: mediaFileId,
    type: mediaType,
  };

  return patchChatSettings(
    ctx,
    pendingAction.chatId,
    {
      settings: {
        thresholds: await mergeThreshold(pendingAction.chatId, newThreshold),
      },
    },
    "✅ Media saved successfully!",
    "❌ Failed to save media"
  );
}
