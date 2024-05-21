import { startBot } from "./bot";

require("dotenv").config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN must be set in the environment.");
  process.exit(1);
}

try {
  startBot(process.env.TELEGRAM_BOT_TOKEN);
} catch (error) {
  console.error("Failed to initialize the bot:", error);
  process.exit(1); // Exit process with an error code
}
