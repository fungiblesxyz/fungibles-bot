import { Bot } from "grammy";
import { setupEvents } from "./event";

export function startBot(token: string) {
  const bot = new Bot(token);

  // Setup event handlers
  setupEvents(bot);

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("SIGINT received. Stopping the bot.");
    bot.stop();
    process.exit(0); // Optional: Explicitly exit the process
  });

  process.on("SIGTERM", () => {
    console.log("SIGTERM received. Stopping the bot.");
    bot.stop();
    process.exit(0); // Optional: Explicitly exit the process
  });

  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1); // Optional: exit process after logging the error
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1); // Optional: exit process after logging the error
  });

  bot.start().catch((error) => {
    console.error("Failed to start the bot:", error);
    process.exit(1); // Exit process with an error code
  });
}
