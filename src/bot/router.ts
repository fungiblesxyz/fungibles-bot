import { Context } from "grammy";
import { fetchChatData } from "../helpers/utils";
import { actionStore } from "./actions";
import {
  handleRemoveWebhook,
  handleRemoveMedia,
  showChatSettings,
  showMediaSettings,
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
    prefix: "chat-set_imageWebhook",
    handler: async (ctx) => {
      return actionStore.setPendingAction(ctx, "emojiStep");
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
    prefix: "chat-set_media",
    handler: async (ctx, chatId) => {
      const chatData = await fetchChatData(chatId);
      return showMediaSettings(ctx, chatId, chatData);
    },
  },
  {
    prefix: "chat-remove_webhook",
    handler: async (ctx, chatId) => {
      return handleRemoveWebhook(ctx, chatId);
    },
  },
  {
    prefix: "chat-remove_media",
    handler: async (ctx, chatId) => {
      return handleRemoveMedia(ctx, chatId);
    },
  },
];

export const handleRouteCallback = async (ctx: any) => {
  const callbackData = ctx.callbackQuery.data;

  for (const route of routes) {
    if (callbackData.startsWith(route.prefix)) {
      const params = callbackData.replace(route.prefix, "").split("_");

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

  console.log("Unknown button event with payload:", callbackData);
  return ctx.answerCallbackQuery();
};
