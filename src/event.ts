import { Bot } from "grammy";
import { isAddress } from "viem";
import {
  setParticipant,
  getParticipants,
  initEvent,
  hasBalanceReq,
} from "./queries";
import { getStartMessage } from "./text";
import { getTimeString, isAdmin } from "./utils";

interface EventState {
  id: number;
  running: boolean;
  messageId: number;
  event: any;
  signupEndTimestamp: number;
}

let eventState: EventState = {
  id: 0,
  running: false,
  messageId: 0,
  event: {},
  signupEndTimestamp: 0,
};

function resetEventState(): void {
  eventState = {
    id: 0,
    running: false,
    messageId: 0,
    event: {},
    signupEndTimestamp: 0,
  };
}

export function setupEvents(bot: Bot): void {
  bot.command("startEvent", async (ctx) => {
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
        `Event signup is currently running. Please wait for it to finish before starting a new one.`
      );
      return;
    }

    const index = Number(ctx.message?.text.split(" ")[1]);
    const timestamp = Number(ctx.message?.text.split(" ")[2]);
    const prize = Number(ctx.message?.text.split(" ")[3]);
    const max = Number(ctx.message?.text.split(" ")[4]);

    if (index === undefined || !timestamp || !prize || !max) {
      await ctx.reply(
        "Invalid command. Please provide an index, signup end timestamp, prize, and max participants."
      );
      return;
    }

    try {
      await initEvent({ index, prize, timestamp, max });
      const { data } = await getParticipants(eventState.id);
      eventState.event.max = max - Number(data?.length) || max;
      eventState.event.prize = prize;
      eventState.signupEndTimestamp = timestamp;
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
          const { data } = await getParticipants(eventState.id);
          if (!data || data?.length === 0) {
            await ctx.reply(
              "No one signed up for the event. The event will be cancelled."
            );
            resetEventState();
            return;
          }

          const participantsString = data
            .map((p: { telegram: string }) => `@${p.telegram}`)
            .join(", ");
          await ctx.reply(
            `Signup ended! There were ${data.length} signups: ${participantsString}. The event will start soon. Head over to truffi.xyz`
          );

          const participantsAddresses = data.map(
            (p: { address: string }) => p.address
          );
          await ctx.reply(
            `Participants: <code>${JSON.stringify(
              participantsAddresses
            )}</code>`,
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
          'You need at least 500 TRUFFI to participate. Head over to <a href="https://app.uniswap.org/explore/tokens/base/0x2496a9AF81A87eD0b17F6edEaf4Ac57671d24f38">Uniswap</a> to get some.',
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
          `You are signed up! The event will start in ${getTimeString(
            eventState.signupEndTimestamp
          )}.
          
There are ${json.data.left} spots left.`,
          {
            reply_parameters: {
              message_id: ctx.message.message_id,
            },
          }
        );
      } else if (json.message === "Event is full of participants") {
        await ctx.reply(
          "The event is full. Don't worry, the next one will be soon.",
          {
            reply_parameters: {
              message_id: ctx.message.message_id,
            },
          }
        );
      } else if (json.message === "This user is already participating") {
        await ctx.reply("You are already signed up for this event.", {
          reply_parameters: {
            message_id: ctx.message.message_id,
          },
        });
      } else {
        await ctx.reply(
          json.message || "An error occurred while signing up for the event.",
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
