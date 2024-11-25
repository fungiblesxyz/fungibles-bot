export type ActionType =
  | "setup"
  | "emoji"
  | "imageWebhook"
  | "minBuy"
  | "emojiStep"
  | "media";

export interface PendingAction {
  callbackData: string;
  chatId: string;
  action: ActionType;
  promptMessage: string;
}

export interface TokenInfo {
  decimals: string;
  id: string;
  name: string;
  symbol: string;
  totalSupply: string;
}

export interface Pools {
  UniswapV2?: string;
  UniswapV3?: string;
}

export interface ChatEntry {
  id: string;
  threadId?: number;
  info: TokenInfo;
  pools?: Pools;
  settings?: {
    emoji?: string;
    imageUrl?: string;
    minBuyAmount?: number;
    emojiStepAmount?: number;
    thresholds?: {
      threshold: number;
      fileId: string;
      type: "photo" | "video" | "animation";
    }[];
    customWebhookUrl?: string;
  };
}

export interface ChatResponse {
  [key: string]: ChatEntry;
}

export interface BuyEventData {
  buyer: {
    address: string;
    balance: bigint;
    formattedBalance: string;
    isNew: boolean;
    stats: any; // Consider creating a proper type for stats
  };
  amounts: {
    in: string;
    out: string;
    spentUsd: number;
    balanceUsd: number;
  };
  prices: {
    ethPerToken: number;
    ethUsd: number;
  };
  transaction: {
    hash: string;
  };
}
