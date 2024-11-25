import { PendingAction, ActionType } from "../helpers/types";
import { Context, InlineKeyboard } from "grammy";

const PROMPT_MESSAGES: Record<ActionType, string> = {
  setup: "➡️ Send your token address",
  emoji: "➡️ Send your preferred emoji",
  imageWebhook: "➡️ Send your image URL (must start with http:// or https://)",
  minBuy:
    "➡️ Send minimum buy amount in USD to trigger alerts (e.g., 100). Buys below this amount will be ignored.",
  emojiStep: "➡️ Send emoji step amount in USD (e.g., 100).",
  media: "➡️ Send your image or video directly to this chat",
};

class ActionStore {
  readonly pendingActions: Map<number, PendingAction>;
  private currentChatId: string;

  constructor() {
    this.pendingActions = new Map<number, PendingAction>();
    this.currentChatId = "";
  }

  getPendingAction(userId: number): PendingAction | undefined {
    return this.pendingActions.get(userId);
  }

  async setPendingAction(ctx: Context, action: ActionType): Promise<void> {
    if (!ctx.from) return;

    if (!action) return console.error("No action found");

    this.pendingActions.set(ctx.from.id, {
      callbackData: ctx.callbackQuery?.data ?? "",
      chatId: ctx.chat?.id.toString() ?? "",
      action,
      promptMessage: PROMPT_MESSAGES[action],
    });

    await ctx.editMessageText(PROMPT_MESSAGES[action], {
      reply_markup: new InlineKeyboard().text("Cancel", "cancel"),
    });
  }

  deletePendingAction(userId: number): void {
    this.pendingActions.delete(userId);
  }

  setCurrentChatId(chatId: string): void {
    this.currentChatId = chatId;
  }

  getCurrentChatId(): string {
    return this.currentChatId;
  }

  clearCurrentChatId(): void {
    this.currentChatId = "";
  }
}

export const actionStore = new ActionStore();
