import { bot } from "./bot/index";
import { monitorBuys, updateChats } from "./server/buys";
import { CronJob } from "cron";

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
export const job = new CronJob(
  "*/20 * * * * *", // every 20 seconds
  updateChats
);

monitorBuys();
job.start();
