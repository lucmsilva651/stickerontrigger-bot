const { getStrings } = require('./plugins/checklang.js');
require("@dotenvx/dotenvx").config({ path: ".env" });
const { Telegraf } = require("telegraf");
const fs = require("node:fs");

const dbRequire = process.env.triggerFile;

// Ensures bot token is set, and not default value
if (!process.env.botToken || process.env.botToken === "InsertYourBotTokenHere") {
  console.error("Bot token is not set. Please set the bot token in the .env file.")
  process.exit(1)
}

const bot = new Telegraf(process.env.botToken);
const maxRetries = process.env.maxRetries || 5;
let restartCount = 0;

const stickerData = JSON.parse(fs.readFileSync(dbRequire, "utf-8"));

const triggersMap = {};
for (const key in stickerData) {
  const entry = stickerData[key];
  const trigger = entry.trigger.toLowerCase();
  const stickers = Object.values(entry.sticker);
  triggersMap[trigger] = stickers;
}

bot.start(async (ctx) => {
  const botInfo = await bot.telegram.getMe();
  const botSource = process.env.botSource;
  const botOwner = process.env.botOwner;
  const Strings = getStrings(ctx.from.language_code);
  const message = Strings.welcomeBot
    .replace("{name}", botInfo.first_name)
    .replace("{source}", botSource)
    .replace("{owner}", botOwner);

  ctx.reply(message, {
    reply_to_message_id: ctx.message.message_id,
    parse_mode: "Markdown"
  })
})

bot.command("triggers", async (ctx) => {
  const Strings = getStrings(ctx.from.language_code);
  const triggerList = Object.values(stickerData).map(entry => `- \`${entry.trigger}\``).join("\n");
  const message = Strings.availableTriggers.replace("{list}", triggerList);

  await ctx.reply(message, {
    reply_to_message_id: ctx.message.message_id,
    parse_mode: "Markdown"
  })
});


bot.on("text", async (ctx) => {
  const message = ctx.message.text.toLowerCase();
  for (const trigger in triggersMap) {
    if (message.includes(trigger)) {
      const stickers = triggersMap[trigger];
      const randomSticker = stickers[Math.floor(Math.random() * stickers.length)];
      await ctx.replyWithSticker(randomSticker, {
        reply_to_message_id: ctx.message.message_id
      });
      return;
    }
  }
});

const startBot = async () => {
  const botInfo = await bot.telegram.getMe();
  const restartWait = process.env.restartWait || 5000;
  console.log(`${botInfo.first_name} is running...`);
  try {
    await bot.launch();
    restartCount = 0;
  } catch (error) {
    console.error("Failed to start bot:", error.message);
    if (restartCount < Number(maxRetries)) {
      console.log(`Waiting ${restartWait}ms before retrying...`);
      await new Promise(r => setTimeout(r, restartWait));
      restartCount++;
      console.log(`Retrying to start bot... Attempt ${restartCount}`);
      setTimeout(startBot, 5000);
    } else {
      console.error("Maximum retry attempts reached. Exiting.");
      process.exit(1);
    }
  }
};

const handleShutdown = (signal) => {
  console.log(`Received ${signal}. Stopping bot...`);
  bot.stop(signal);
  process.exit(0);
};

process.once("SIGINT", () => handleShutdown("SIGINT"));
process.once("SIGTERM", () => handleShutdown("SIGTERM"));

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error.message);
  console.error(error.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

startBot()


