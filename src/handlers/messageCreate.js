const { ChannelType } = require("discord.js");
const { ChatsSchema } = require("../models/Schemas");

const messageCreate = async (message, client, type, secondClient) => {
    if (type === 0) {
        if (message.author.bot) return;
        if (message.channel.type !== 1) return; // ЛС

        console.log(message)

        if (message.author.id === process.env.DISCORD_USER_ID && telegramChatId) {
            try {
              await telegramBot.telegram.sendMessage(telegramChatId, `От ${message.author.username}: ${message.content}`);
            } catch (err) {
              console.error('Ошибка при отправке в Telegram:', err);
            }
        }
    } else if (type === 1) {
        const chat = message.chat;
        const msg = message.message;
        console.log(message)
        console.log(chat)

        var chatSchema = await ChatsSchema.findOne({ id: chat.id });
        if (!chatSchema) { 
            const guild = secondClient.guilds.cache.get(process.env.GUILD_ID);
            if (!guild) {
                console.log('Guild not found.');
                return;
            }
            const category = guild.channels.cache.get(process.env.CATEGORY_ID);

            if (!category || category.type !== ChannelType.GuildCategory) {
                console.log('Invalid category ID or not a category.');
                return;
            }
            const newChannel = await guild.channels.create({
                name: chat.title,
                type: ChannelType.GuildText,
                parent: category.id,
            });
            await newChannel.send("new chat created");
            chatSchema = await ChatsSchema.create({ telegramId: chat.id, discordId: newChannel.id, name: chat.title, messages: [] });
        }

        if (chat.type === 'supergroup' || chat.type === 'group') {
            if (chat.title === process.env.TELEGRAM_CHAT_TITLE) {
            telegramChatId = chat.id; // сохраняем chat_id один раз

            const sender = msg.from.username || `${msg.from.first_name} ${msg.from.last_name || ''}`;
            const text = msg.text || '[не текстовое сообщение]';

            try {
                const user = await discordClient.users.fetch(process.env.DISCORD_USER_ID);
                await user.send(`**${sender}**: ${text}`);
            } catch (err) {
                console.error('Ошибка при отправке в Discord:', err);
            }
            }
        }
    }
}

module.exports = messageCreate;