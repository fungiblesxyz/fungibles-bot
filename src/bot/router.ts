import { Context } from "grammy";
import { fetchChatData } from "../helpers/utils";
import { actionStore } from "./actions";
import {
  handleRemoveMedia,
  showChatSettings,
  showThresholds,
} from "./callbacks";

type CallbackHandler = (ctx: Context, ...args: string[]) => Promise<any>;

interface RouteConfig {
  prefix: string;
  handler: CallbackHandler;
}

const routes: RouteConfig[] = [
  {
    prefix: "chat-setup",
    handler: async (ctx) => {
      return actionStore.setPendingAction(ctx, "setup");
    },
  },
  {
    prefix: "chat-settings",
    handler: async (ctx, chatId) => {
      const chatData = await fetchChatData(chatId);
      return showChatSettings(ctx, chatData);
    },
  },
  {
    prefix: "chat-set_emoji",
    handler: async (ctx) => {
      return actionStore.setPendingAction(ctx, "emoji");
    },
  },
  {
    prefix: "chat-set_minBuy",
    handler: async (ctx) => {
      return actionStore.setPendingAction(ctx, "minBuy");
    },
  },
  {
    prefix: "chat-set_emojiStep",
    handler: async (ctx) => {
      return actionStore.setPendingAction(ctx, "emojiStep");
    },
  },
  {
    prefix: "chat-set_threshold-amount",
    handler: async (ctx, chatId) => {
      return actionStore.setPendingAction(ctx, "thresholdAmount");
    },
  },
  {
    prefix: "chat-set_threshold-media",
    handler: async (ctx, chatId, amount) => {
      return actionStore.setPendingAction(ctx, "thresholdMedia", amount);
    },
  },
  {
    prefix: "chat-set_threshold-webhook",
    handler: async (ctx, chatId, amount) => {
      console.log("🚀 ~ handler: ~ amount:", amount);
      return actionStore.setPendingAction(ctx, "thresholdWebhook", amount);
    },
  },
  {
    prefix: "chat-remove_media",
    handler: async (ctx, chatId) => {
      return handleRemoveMedia(ctx, chatId);
    },
  },
  {
    prefix: "chat-thresholds",
    handler: async (ctx, chatId) => {
      return showThresholds(ctx, chatId);
    },
  },
];

export const handleRouteCallback = async (ctx: any) => {
  const callbackData = ctx.callbackQuery.data;

  for (const route of routes) {
    if (callbackData.startsWith(route.prefix)) {
      const params = callbackData
        .replace(route.prefix, "")
        .split("_")
        .filter((p: string) => p !== "");

      if (callbackData.split("#")[1]) {
        actionStore.setCurrentChatId(callbackData.split("#")[1]);
      }

      const chatId = actionStore.getCurrentChatId();
      if (!chatId) {
        return console.error("No chatId found");
      }

      return route.handler(ctx, chatId, ...params);
    }
  }

  console.error("Unknown button event with payload:", callbackData);
  return ctx.answerCallbackQuery();
};
