const { Telegraf } = require('telegraf');
const { Client, GatewayIntentBits } = require('discord.js');
const messageCreate = require('./messageCreate');

const ready = async () => {
    const telegramBot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    const discordClient = new Client({ intents: [GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds], partials: ['CHANNEL'] });
    
    // Telegram -> Discord
    telegramBot.on('message', async (ctx) => {
        messageCreate(ctx, telegramBot, 1, discordClient);
    });
    
    // Discord -> Telegram
    discordClient.on('messageCreate', async (message) => {
        console.log(message)
        messageCreate(message, discordClient, 0, telegramBot);
    });
    
    // Запуск
    telegramBot.launch().then(() => console.log("Telegram bot started"));
    discordClient.login(process.env.DISCORD_BOT_TOKEN).then(() => console.log("Discord bot started"));
    
    process.once('SIGINT', () => telegramBot.stop('SIGINT'));
    process.once('SIGTERM', () => telegramBot.stop('SIGTERM'));
}

module.exports = ready;