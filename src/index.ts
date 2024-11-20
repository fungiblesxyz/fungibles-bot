import { CronJob } from "cron";
import { bot } from "./bot/index";
import { monitorBuys, updateChats } from "./server/buys";
import { callAgent } from "./agents/index";

require("dotenv").config();

// Start the bot
bot.start().catch((err) => {
  if (err.error_code === 409) {
    console.warn("Warning: Another bot instance may be running");
  } else {
    console.error("Bot startup error:", err);
  }
});

// Start the server job
export const updateChatsJob = new CronJob(
  "*/20 * * * * *", // every 20 seconds
  updateChats
);

monitorBuys();
updateChatsJob.start();

// Start the agent job
export const callAgentJob = new CronJob(
  "0 */15 * * * *", // every 15 minutes
  callAgent,
  null,
  true,
  undefined,
  undefined,
  true
);
callAgentJob.start();
