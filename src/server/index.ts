import { CronJob } from "cron";
import { monitorBuys, refreshData } from "./buys";

async function start() {
  const refreshDataJob = new CronJob(
    "*/20 * * * * *", // every 20 seconds
    refreshData
  );

  await refreshData();
  monitorBuys();
  refreshDataJob.start();
}

start().catch((err) => {
  console.error("Server startup error:", err);
});
