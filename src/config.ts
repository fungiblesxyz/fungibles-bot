import dotenv from "dotenv";
dotenv.config();

// Bot Configuration
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
export const TELEGRAM_SYSTEM_BOT_TOKEN = process.env.TELEGRAM_SYSTEM_BOT_TOKEN!;
export const NODE_ENV = process.env.NODE_ENV ?? "development";

// API Configuration
export const CHATS_API_URL = process.env.CHATS_API_URL!;
export const CHATS_API_TOKEN = process.env.CHATS_API_TOKEN!;
export const THEGRAPH_API_KEY = process.env.THEGRAPH_API_KEY!;

// Blockchain Configuration
export const BUYS_FROM_BLOCK_NUMBER = process.env.BUYS_FROM_BLOCK_NUMBER
  ? BigInt(process.env.BUYS_FROM_BLOCK_NUMBER)
  : undefined;

// System Chat Configuration
export const SYSTEM_CHAT_ID = "-1002420548293";
export const SYSTEM_THREAD_ID = 2;

// Type guard to ensure required environment variables are present
const requiredEnvVars = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_SYSTEM_BOT_TOKEN",
  "CHATS_API_URL",
  "CHATS_API_TOKEN",
  "THEGRAPH_API_KEY",
] as const;

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});
