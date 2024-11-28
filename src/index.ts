import { CronJob } from "cron";
import { bot } from "./bot/index";
import { monitorBuys, refreshData } from "./server/buys";
// import { callAgent } from "./agents/index";

require("dotenv").config();

// Start the bot
bot.start().catch((err) => {
  if (err.error_code === 409) {
    console.warn("Warning: Another bot instance may be running");
  } else {
    console.error("Bot startup error:", err);
  }
});

async function start() {
  // Start the server job
  const refreshDataJob = new CronJob(
    "*/20 * * * * *", // every 20 seconds
    refreshData
  );

  await refreshData();
  monitorBuys();
  refreshDataJob.start();
}

start();

// // Start the agent job
// export const callAgentJob = new CronJob(
//   "0 */15 * * * *", // every 15 minutes
//   callAgent
// );
// callAgentJob.start();
