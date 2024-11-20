import { Context } from "grammy";
import { sendMessageToChat } from "../helpers/bot";
import { botSystemMessage, communityTheme } from "./config";

const API_URL = "https://api.x.ai/v1/chat/completions";

if (!process.env.XAI_API_KEY) {
  console.error("XAI_API_KEY must be set in the environment.");
  process.exit(1);
}

const messages = [
  {
    role: "system",
    content: botSystemMessage,
  },
  {
    role: "user",
    content: `Community Theme: ${communityTheme}`,
  },
];

let currentAgentMessageId: number | undefined;

async function callXAIApi(messages: any[]) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      messages,
      model: "grok-beta",
      stream: false,
      temperature: 0,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function callAgent() {
  try {
    const content = await callXAIApi(messages);
    if (!content) return;

    messages.push({
      role: "assistant",
      content,
    });
    console.log("🚀 ~ callAgent ~ messages:", messages);

    let agentMessageId: number | undefined;

    // Send and store the message ID
    const sentMessage = await sendMessageToChat("-1002420548293", content, 169);
    if (sentMessage) {
      agentMessageId = sentMessage.message_id;
    }
    if (agentMessageId) currentAgentMessageId = agentMessageId;

    console.log(content);
  } catch (error) {
    console.error("Error calling xAI API:", error);
  }
}

export function addAgentUserReply(ctx: Context) {
  if (!currentAgentMessageId || !ctx.chat) return;

  // Check if the message is a reply and to the correct message
  if (
    ctx.message?.reply_to_message?.message_id === currentAgentMessageId &&
    ctx.chat.id.toString() === "-1002420548293" &&
    ctx.message.message_thread_id === 169
  ) {
    const replyText = ctx.message.text;
    if (!replyText) return;

    messages.push({
      role: "user",
      content: replyText,
    });
    console.log("🚀 ~ addAgentUserReply ~ messages:", messages);
  }
}
