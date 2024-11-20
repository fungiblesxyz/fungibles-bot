import { CronJob } from "cron";
import { monitorBuys, updateChats } from "./buys";

const job = new CronJob(
  "*/20 * * * * *", // every 20 seconds
  updateChats
);

monitorBuys();
job.start();
