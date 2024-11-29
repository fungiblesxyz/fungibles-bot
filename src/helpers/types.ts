export type ActionType =
  | "setup"
  | "emoji"
  | "minBuy"
  | "emojiStep"
  | "thresholdAmount"
  | "thresholdMedia"
  | "thresholdWebhook";

export interface PendingAction {
  callbackData: string;
  chatId: string;
  action: ActionType;
  promptMessage: string;
  data?: any;
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
    minBuyAmount?: number;
    emojiStepAmount?: number;
    thresholds?: Threshold[];
  };
}

export interface Threshold {
  threshold: number;
  fileId?: string;
  customWebhookUrl?: string;
  type?: "photo" | "video" | "animation";
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
