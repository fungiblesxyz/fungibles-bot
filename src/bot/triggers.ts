import { Context } from "grammy";
import { sendLogToChannel, sendMessageToChat } from "../helpers/bot";

export async function handleChatMemberUpdate(ctx: Context) {
  const update = ctx.myChatMember;
  if (!update) return;

  sendLogToChannel(`Updated status: ${update.new_chat_member.status}`, {
    type: "log",
  });
  switch (update.new_chat_member.status) {
    case "member":
    case "administrator":
      try {
        await sendMessageToChat(
          update.chat.id.toString(),
          `👋 Hey, I am FungiblesBot, your favorite ERC20i bot!`
        );
        sendLogToChannel(
          `Chat ${update.chat.id} added the bot to their group`,
          {
            type: "log",
          }
        );
        const response = await fetch(process.env.CHATS_API_URL!, {
          method: "POST",
          body: JSON.stringify({ id: update.chat.id.toString() }),
          headers: {
            Authorization: `Bearer ${process.env.CHATS_API_TOKEN}`,
          },
        });
        if (!response.ok) {
          const errorMessage = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorMessage}`
          );
        }
      } catch (error) {
        console.error("Failed to register chat:", error);
        sendLogToChannel(`Failed to register chat: ${error}`, {
          chatId: update.chat.id,
        });
      }
      break;
    case "left":
    case "kicked":
      try {
        sendLogToChannel(
          `Chat ${update.chat.id} removed the bot from their group`,
          {
            type: "log",
          }
        );
        const response = await fetch(
          `${process.env.CHATS_API_URL}/${update.chat.id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${process.env.CHATS_API_TOKEN}`,
            },
          }
        );
        if (!response.ok) {
          const errorMessage = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorMessage}`
          );
        }
      } catch (error) {
        console.error("Failed to delete chat:", error);
        sendLogToChannel(`Failed to delete chat: ${error}`, {
          chatId: update.chat.id,
        });
      }
      break;
  }
}
