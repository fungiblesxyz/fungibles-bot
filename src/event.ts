import { Bot } from "grammy";
import { isAddress } from "viem";
import { setParticipant, getParticipants, getEvent } from "./queries";
import { getStartMessage } from "./text";

interface EventState {
  id: number;
  running: boolean;
  messageIds: number[];
  event: any;
}

let eventState: EventState = {
  id: 0,
  running: false,
  messageIds: [],
  event: {},
};

let hoursPassed = 0;
let totalDurationHours = 12;
const intervalDurationMilliseconds = 60 * 60 * 1000;
let totalDurationMilliseconds =
  totalDurationHours * intervalDurationMilliseconds;

function resetEventState(): void {
  eventState = {
    id: 0,
    running: false,
    messageIds: [],
    event: {},
  };
}

export function setupEvents(bot: Bot): void {
  bot.command("startevent", async (ctx) => {
    if (eventState.running) {
      await ctx.reply(
        `Event signup is currently running. Please wait for it to finish before starting a new one.`
      );
      return;
    }

    const index = ctx.message?.text.split(" ")[1];
    totalDurationHours =
      Number(ctx.message?.text.split(" ")[2]) || totalDurationHours;
    totalDurationMilliseconds =
      totalDurationHours * intervalDurationMilliseconds;
    if (!index) {
      await ctx.reply("Please provide an id for the event.");
      return;
    }

    try {
      eventState.event = await getEvent(Number(index));
    } catch (error) {
      console.error(error);
      await ctx.reply(
        "Failed to retrieve event details. Please try again later."
      );
      return;
    }

    let eventStartedMessage;
    try {
      eventStartedMessage = await ctx.replyWithPhoto(
        "https://www.truffi.xyz/banner-event.png",
        {
          parse_mode: "HTML",
          caption: getStartMessage(
            Number(index),
            `${totalDurationHours} hours`,
            eventState.event.prize,
            eventState.event.max
          ),
        }
      );
    } catch (error) {
      console.error(error);
      await ctx.reply(
        "Failed to send event start message. Please try again later."
      );
      return;
    }

    eventState = {
      id: Number(index),
      running: true,
      messageIds: [eventStartedMessage.message_id],
      event: eventState.event,
    };

    const intervalId = setInterval(async () => {
      hoursPassed++;
      if (hoursPassed < totalDurationHours) {
        try {
          eventStartedMessage = await ctx.replyWithPhoto(
            "https://www.truffi.xyz/banner-event.png",
            {
              parse_mode: "HTML",
              caption: getStartMessage(
                Number(index),
                `${totalDurationHours - hoursPassed} hours remaining`,
                eventState.event.prize,
                eventState.event.max
              ),
            }
          );
          eventState.messageIds.push(eventStartedMessage.message_id);
        } catch (error) {
          console.error(error);
          clearInterval(intervalId);
          await ctx.reply(
            "Failed to update event status. Please check manually."
          );
          resetEventState();
          return;
        }
      } else {
        clearInterval(intervalId);
      }
    }, intervalDurationMilliseconds);

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
          `Participants: <code>${JSON.stringify(participantsAddresses)}</code>`,
          {
            parse_mode: "HTML",
          }
        );

        resetEventState();
      } catch (error) {
        console.error(error);
        await ctx.reply(
          "Failed to finalize the event signup. Please try again later."
        );
        resetEventState();
      }
    }, totalDurationMilliseconds);
  });

  bot.on("message:text", async (ctx) => {
    if (
      !eventState.messageIds.includes(
        ctx.message.reply_to_message?.message_id || 0
      )
    ) {
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
      const response = await setParticipant(
        text,
        ctx.message.from.username,
        eventState.id
      );
      const json = await response.json();

      if (response.status === 200) {
        await ctx.reply(
          `You are signed up! The event will start in ${
            totalDurationHours - hoursPassed
          } hours. Good luck!`,
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
        await ctx.reply("You already signed up for this event.", {
          reply_parameters: {
            message_id: ctx.message.message_id,
          },
        });
      }
    } catch (error) {
      console.error(error);
      await ctx.reply(
        "An error occurred while signing you up. Please try again.",
        {
          reply_parameters: {
            message_id: ctx.message.message_id,
          },
        }
      );
    }
  });
}
