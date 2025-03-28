require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Client, GatewayIntentBits } = require('discord.js');

const telegramBot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const discordClient = new Client({ intents: [GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds], partials: ['CHANNEL'] });

let telegramChatId = null;

// Telegram -> Discord
telegramBot.on('message', async (ctx) => {
  const chat = ctx.chat;
  const message = ctx.message;

  if (chat.type === 'supergroup' || chat.type === 'group') {
    if (chat.title === process.env.TELEGRAM_CHAT_TITLE) {
      telegramChatId = chat.id; // сохраняем chat_id один раз

      const sender = message.from.username || `${message.from.first_name} ${message.from.last_name || ''}`;
      const text = message.text || '[не текстовое сообщение]';

      try {
        const user = await discordClient.users.fetch(process.env.DISCORD_USER_ID);
        await user.send(`**${sender}**: ${text}`);
      } catch (err) {
        console.error('Ошибка при отправке в Discord:', err);
      }
    }
  }
});

// Discord -> Telegram
discordClient.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.type !== 1) return; // ЛС

  if (message.author.id === process.env.DISCORD_USER_ID && telegramChatId) {
    try {
      await telegramBot.telegram.sendMessage(telegramChatId, `От ${message.author.username}: ${message.content}`);
    } catch (err) {
      console.error('Ошибка при отправке в Telegram:', err);
    }
  }
});

// Запуск
telegramBot.launch();
discordClient.login(process.env.DISCORD_BOT_TOKEN);

process.once('SIGINT', () => telegramBot.stop('SIGINT'));
process.once('SIGTERM', () => telegramBot.stop('SIGTERM'));
