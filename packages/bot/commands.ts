import { InlineKeyboard, Context } from "grammy";

export async function handleStartCommand(ctx: Context) {
  if (ctx.chat?.type !== "private") {
    const button = new InlineKeyboard().url(
      "Click Me",
      `https://t.me/${ctx.me.username}`
    );

    return ctx.reply(
      "⬇️ Click the button below to proceed the setup in private chat!",
      {
        reply_markup: button,
      }
    );
  }

  const mainMenu = new InlineKeyboard()
    .url(
      "➕ Add me to your group",
      `https://t.me/${ctx.me.username}?startgroup=true`
    )
    .row()
    .text("⚙️ Settings", "settings");

  return ctx.reply(
    `Welcome to Fungibles Bot!

To get started, add me to your group and configure token tracking settings!

✨ Unique Features:
• Custom ERC20i features
• Buyer status indicator

💎 Built by ERC20i bulls, for the community:
• 100% free and open-source
    
[Website](https://fungibles.xyz) | [Telegram](https://t.me/fungibles_ERC20i) | [Suggestions](https://fungibles.canny.io/suggestions) | [Support Us](https://app.safe.global/balances?safe=base:0x45083345B7E20d9916dDa046344Ec518bf9e21D0)
    `,
    {
      reply_markup: mainMenu,
      parse_mode: "Markdown",
      link_preview_options: {
        is_disabled: true,
      },
    }
  );
}
