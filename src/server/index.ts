// import { CronJob } from "cron";
import { monitorBuys } from "./buys";

// const job = new CronJob(
//   "*/20 * * * * *", // every 20 seconds
//   monitorBuys
// );

monitorBuys();
// job.start();
