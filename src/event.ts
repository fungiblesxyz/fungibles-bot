import { Bot } from "grammy";
import { isAddress } from "viem";
import {
  setParticipant,
  getParticipants,
  hasBalanceReq,
  getStats,
} from "./queries";
import { getStartMessage } from "./text";
import { getTimeString, isAdmin, formatNumber } from "./utils";

interface EventState {
  id: number;
  running: boolean;
  messageId: number;
  event: any;
  end: number;
}

let eventState: EventState = {
  id: 0,
  running: false,
  messageId: 0,
  event: {},
  end: 0,
};

function resetEventState(): void {
  eventState = {
    id: 0,
    running: false,
    messageId: 0,
    event: {},
    end: 0,
  };
}

async function huntStatus(ctx: any, left: number) {
  const { data } = await getStats(eventState.id);
  const stats = data.stats;

  if (!eventState.running) {
    await ctx.reply("There is currently no hunt.");
    return;
  }
  await ctx.reply(
    `<b>🌕🍄 Truffi Hunt Status 🌕🍄</b>

Ends in: ${getTimeString(eventState.end)}
Spots left: ${left}
Current Prize Pool: ${formatNumber(stats.currentPrize)} TRUFFI
Collect so far: ${formatNumber(stats.filledSlots)}
Average per slot: ${Number(
      formatNumber(stats.currentPoints / stats.filledSlots)
    ).toFixed(1)} TRUFFI`,
    {
      parse_mode: "HTML",
    }
  );
}

export function setupEvents(bot: Bot): void {
  bot.command("hunt", async (ctx) => {
    huntStatus(ctx, eventState.event.max);
  });

  bot.command("startHunt", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private" || !ctx.from) {
      await ctx.reply("This command can only be used in group chats.");
      return;
    }

    const userIsAdmin = await isAdmin(bot, ctx.from.id, ctx.chat.id);
    if (!userIsAdmin) {
      await ctx.reply("You need to be an admin to start an event.");
      return;
    }

    if (eventState.running) {
      await ctx.reply(
        `Hunt is currently running. Please wait for it to finish before starting a new one.`
      );
      return;
    }

    const index = Number(ctx.message?.text.split(" ")[1]);
    const timestamp = Number(ctx.message?.text.split(" ")[2]);
    const prize = Number(ctx.message?.text.split(" ")[3]);
    const max = Number(ctx.message?.text.split(" ")[4]);

    if (index === undefined || !timestamp || !prize || !max) {
      await ctx.reply(
        "Invalid command. Please provide an index, timestamp, prize, and max participants."
      );
      return;
    }

    try {
      const { data } = await getParticipants(eventState.id);
      eventState.event.max = max - Number(data?.length) || max;
      eventState.event.prize = prize;
      eventState.end = timestamp;
      eventState.running = true;
      eventState.id = index;
    } catch (error: any) {
      console.error(error);
      await ctx.reply(
        error.message || "An error occurred while initializing the event."
      );
      return;
    }

    try {
      const response = await ctx.replyWithPhoto(
        "https://www.truffi.xyz/banner-event.png",
        {
          parse_mode: "HTML",
          caption: getStartMessage(
            index,
            getTimeString(timestamp),
            eventState.event.prize,
            eventState.event.max
          ),
        }
      );
      eventState.messageId = response.message_id;
    } catch (error: any) {
      console.error(error);
      await ctx.reply(
        error.message || "An error occurred while starting the event."
      );
      return;
    }

    const delay = timestamp - Date.now();
    if (delay > 0) {
      setTimeout(async () => {
        try {
          await ctx.reply(
            `The hunt has ended! The rewards will be distributed soon.`,
            {
              parse_mode: "HTML",
            }
          );

          resetEventState();
        } catch (error: any) {
          console.error(error);
          await ctx.reply(
            error.message || "An error occurred while fetching participants."
          );
          resetEventState();
        }
      }, delay);
    } else {
      await ctx.reply("The signup end timestamp provided has already passed.");
      resetEventState();
    }
  });

  bot.on("message:text", async (ctx) => {
    if (eventState.messageId !== ctx.message.reply_to_message?.message_id) {
      return;
    }

    const text = ctx.message.text.trim().toLowerCase();
    if (!isAddress(text)) {
      await ctx.reply("You sent an invalid ETH address.", {
        reply_parameters: {
          message_id: ctx.message.message_id,
        },
      });
      return;
    }

    if (!ctx.message.from?.username) {
      await ctx.reply(
        "You need to set a username in your telegram account to participate. Try again after setting it.",
        {
          reply_parameters: {
            message_id: ctx.message.message_id,
          },
        }
      );
      return;
    }

    try {
      const hasBalance = await hasBalanceReq(text);
      if (!hasBalance) {
        await ctx.reply(
          'You need at least 3500 TRUFFI to participate. Head over to <a href="https://app.uniswap.org/explore/tokens/base/0x2496a9AF81A87eD0b17F6edEaf4Ac57671d24f38">Uniswap</a> to get some.',
          {
            parse_mode: "HTML",
            reply_parameters: {
              message_id: ctx.message.message_id,
            },
          }
        );
        return;
      }

      const response = await setParticipant(
        text,
        ctx.message.from.username,
        eventState.id
      );
      const json = await response.json();

      if (response.status === 200) {
        await ctx.reply(
          `Looks like you are ready to hunt down those Truffies! It's time to head over to app.truffi.xyz.`,
          {
            reply_parameters: {
              message_id: ctx.message.message_id,
            },
          }
        );
        eventState.event.max = json.data.left;
      } else if (json.message === "Event is full of participants") {
        await ctx.reply(
          "This hunt is full. Don't worry, the next one will be soon.",
          {
            reply_parameters: {
              message_id: ctx.message.message_id,
            },
          }
        );
      } else if (json.message === "This user is already participating") {
        await ctx.reply("You are already part of this hunt.", {
          reply_parameters: {
            message_id: ctx.message.message_id,
          },
        });
      } else {
        await ctx.reply(
          json.message || "An error occurred while adding you to the hunt.",
          {
            reply_parameters: {
              message_id: ctx.message.message_id,
            },
          }
        );
      }
    } catch (error: any) {
      console.error(error);
      await ctx.reply(`${error?.message}`, {
        reply_parameters: {
          message_id: ctx.message.message_id,
        },
      });
    }
  });
}
