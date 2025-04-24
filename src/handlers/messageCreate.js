const { ChannelType, WebhookClient } = require("discord.js");
const fetch = require('node-fetch');
const fs = require('fs-extra');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const path = require('path');
const mime = require('mime-types');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const { ChatsSchema } = require("../models/schemas");
const { convertLottieToGif } = require("../convert-lottie/lottie_to_gif");
const { Input } = require("telegraf");

const messageCreate = async (message, client, type, secondClient) => {
    if (type === 0) {
        if (message.author.bot) return;
        if (!message.channel.id) return;

        console.log(message)
        var chatSchema = await ChatsSchema.findOne({ discId: message.channel.id });
        if (!chatSchema) return console.log("Chat not found in DB");

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        const channel = guild.channels.cache.get(chatSchema.discId);

        

        if (message.attachments.size > 0) return sendAllAttachments(message, secondClient, chatSchema.telId);
        if (message.stickers.size > 0) {
            const sticker = message.stickers.first();
            await convertLottieToGif(sticker.url, path.join(__dirname, `stickers/${sticker.id}.gif`));
            return sendGifToTelegram(secondClient, chatSchema.telId, path.join(__dirname, `stickers/${sticker.id}.gif`), message.content);
        }
        var replyIdMsg;
        if (message.reference) {
            const ref = await channel.messages.fetch(message.reference.messageId);
            if (ref) {
                const chatSchemaRef = await ChatsSchema.findOne({ discId: ref.channel.id });
                if (chatSchemaRef) {
                    replyIdMsg = chatSchemaRef.messages.find(m => m.discId === ref.id).tgId;
                }
            }
        }

        try {
            const tempMsg = await secondClient.telegram.sendMessage(chatSchema.telId, message.content || " ", {
                reply_to_message_id: replyIdMsg || undefined,
                parse_mode: "HTML",
                disable_web_page_preview: true,
                disable_notification: message.silent || false,
                protect_content: true,
            });
            chatSchema.messages.push({ tgId: tempMsg.message_id, discId: message.id, date: new Date() });
            await chatSchema.save();
        } catch (err) {
            console.error('Ошибка при отправке в Telegram:', err);
        }
    } else if (type === 1) {
        const chat = message.chat;
        const msg = message.message;
        // console.log(message)
        // console.log(chat)
        console.log("----- From ------")
        console.log(msg.from);
        console.log("-----------------")
        console.log("----- Chat ------")
        console.log(msg.chat)
        console.log("-----------------")
        if (msg.reply_to_message) {
            console.log("----- reply_to_message ------")
            console.log(msg.reply_to_message)
            console.log("-----------------")
        }
        if (msg.forward_origin) {
            console.log("----- forward_origin ------")
            console.log(msg.forward_origin)
            console.log("-----------------")
        }
        if (msg.forward_from) {
            console.log("----- forward_from ------")
            console.log(msg.forward_from)
            console.log("-----------------")
        }
        console.log("----- Message ------")
        console.log(message)
        console.log("-----------------")

        var chatSchema = await ChatsSchema.findOne({ telId: chat.id });
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
            // return console.log("tried to create new channel!!!!")
            const newChannel = await guild.channels.create({
                name: chat.title,
                type: ChannelType.GuildText,
                parent: category.id,
            });

            const webhook = await newChannel.createWebhook({
                name: "New Webhook",
            });

            await newChannel.send("Добавлен новый чат.");
            chatSchema = await ChatsSchema.create({ telId: chat.id, discId: newChannel.id, name: chat.title, messages: [], webhook: webhook.url });

            const chatPinned = await message.telegram.getChat(chat.id);
            if (chatPinned.pinned_message) {
                const author = `${chatPinned.pinned_message.from.first_name || ''} ${chatPinned.pinned_message.from.last_name || ''}`.trim() || "Telegram User";
                const photos = await message.telegram.getUserProfilePhotos(chatPinned.pinned_message.from.id);
                var pfp;

                if (photos.total_count === 0) {
                    console.log('No profile photos found.');
                    pfp = getAvatarUrl(author)
                } else {
                    const file_id = photos.photos[0][0].file_id;
                    const file = await message.telegram.getFileLink(file_id);
                    pfp = file.href;
                }
                const pinnedMsg = await webhook.send({
                    content: `${chatPinned.pinned_message.text || chatPinned.pinned_message.caption || ''}`,
                    username: author || "Telegram User",
                    avatarURL: pfp,
                })
                await pinnedMsg.pin();
                console.log("PinnedMSG:", pinnedMsg);
                chatSchema.messages.push({ tgId: chatPinned.pinned_message.message_id, discId: pinnedMsg.id, date: new Date() });
                await chatSchema.save();
            }
        }

        if (chat.type === 'supergroup' || chat.type === 'group') {
            const webhook = new WebhookClient({ url: chatSchema.webhook });
            telegramChatId = chat.id; // сохраняем chat_id один раз
            
            var custom_title = null;

            const member = await message.telegram.getChatMember(chat.id, msg.from.id);

            if (member && member.custom_title) custom_title = member.custom_title;

            const name = (`${msg.from.first_name || ''} ${msg.from.last_name || ''} ${custom_title ? `(${custom_title})` : ""}`.trim()) || "Telegram User";

            const photos = await message.telegram.getUserProfilePhotos(msg.from.id);

            var pfp;

            if (photos.total_count === 0) {
                console.log('No profile photos found.');
                pfp = getAvatarUrl(name)
            } else {
                const file_id = photos.photos[0][0].file_id;
                const file = await message.telegram.getFileLink(file_id);
                pfp = file.href;
            }

            var attachment;

            if (msg.photo) {
                const photo = msg.photo[msg.photo.length - 1];
                const file = await message.telegram.getFileLink(photo.file_id);
                attachment = file.href;
            }
            if (msg.video) {
                const video = msg.video;
                const file = await message.telegram.getFileLink(video.file_id);
                attachment = file.href;
            }
            if (msg.document) {
                const document = msg.document;
                const file = await message.telegram.getFileLink(document.file_id);
                attachment = file.href;
            }
            if (msg.voice) {
                const voice = msg.voice;
                const file = await message.telegram.getFileLink(voice.file_id);
                attachment = await convertVoiceToMp3(file.href, `голосовое сообщение`);
            }
            if (msg.sticker) {
                const sticker = msg.sticker;
                const file = await message.telegram.getFileLink(sticker.file_id);
                attachment = file.href;
            }
            if (msg.new_chat_title) {
                const newTitle = msg.new_chat_title;
                const oldTitle = chatSchema.name;
                chatSchema.name = newTitle;
                await chatSchema.save();
                const guild = secondClient.guilds.cache.get(process.env.GUILD_ID);
                const channel = guild.channels.cache.get(chatSchema.discId);
                console.log(newTitle);
                await webhook.send({
                    content: `\`Название чата изменено с "${oldTitle}" на "${newTitle}"\``,
                    username: name || "Telegram User",
                    avatarURL: pfp,
                });
                return channel.setName(newTitle).catch(err => {
                    console.warn(err);
                })
            }
            if (msg.left_chat_participant) {
                return webhook.send({ content: "\`" + (`${msg.left_chat_participant.first_name || " "} ${msg.left_chat_participant.last_name || " "}`) + " покинул чат\`", username: "Moderation" });
            }
            if (msg.new_chat_members) {
                msg.new_chat_members.map(async member => {
                    await webhook.send({ content:`\`${member.first_name || " "} ${member.last_name || " "} присоединился к чату\``, username: "Moderation" });
                });
                return true;
            }
            var pinned_message;
            if (msg.pinned_message) {
                pinned_message = chatSchema.messages.find(m => m.tgId === msg.pinned_message.message_id.toString()).discId;
                const guild = secondClient.guilds.cache.get(process.env.GUILD_ID);
                const channel = guild.channels.cache.get(chatSchema.discId);
                const message = await channel.messages.fetch(pinned_message);
                const pinnedMessage = await channel.messages.fetchPinned();
                
                pinnedMessage.forEach(async (message) => {
                    await message.unpin();
                });
                return message.pin();
            }

            try {
                var reply;
                if (msg.reply_to_message) {
                    // console.log(chatSchema.messages.find(m => m.tgId === msg.reply_to_message.message_id.toString()))
                    const schema = chatSchema.messages.find(m => m.tgId === msg.reply_to_message.message_id.toString())
                    if (schema && schema.discId) {
                        reply = schema.discId;
                    }
                    // console.log("------------ chatSchema ------------------")
                    // console.log(chatSchema)
                    // console.log("------------ chatSchema ------------------")
                    // console.log("------------ reply ------------------")
                    // console.log(reply)
                    // console.log("------------ reply ------------------")
                    messageLink = `https://discord.com/channels/${process.env.GUILD_ID}/${chatSchema.discId}/${reply}`;
                }

                let contentMsg = '';

                if (msg.sticker) {
                    contentMsg = "[стикер]";
                } else {
                    let prefix = '';
                    
                    // Если это переслано от пользователя
                    if ((msg.forward_origin || msg.forward_from) && msg.forward_origin?.type !== "channel") {
                        const name =
                        msg.forward_origin?.sender_user_name ||
                            `${msg.forward_origin?.sender_user?.first_name || ""} ${msg.forward_origin?.sender_user?.last_name || ""}`.trim();

                        prefix = `\`Переслано из другого чата от ${name}:\`\n\n${msg.text || msg.caption ? "> " : " "}`;
                    }

                    // Если переслано из канала
                    else if (msg.forward_origin?.type === "channel") {
                        prefix = `\`Переслано из канала ${msg.forward_origin.chat.title}:\`\n\n`;
                    }

                    // Сам текст
                    const text = msg.text || msg.caption || ' ';
                    
                    // Формируем всё вместе
                    contentMsg = `${prefix}${text}`;
                }

                const tempMsg = await webhook.send({
                    content: contentMsg,
                    username: name || "Telegram User",
                    avatarURL: pfp,
                    files: attachment ? [attachment] : [],
                    components: reply ? [{
                        type: 1,
                        components: [{
                            type: 2,
                            label: "Ответ",
                            style: 5,
                            url: messageLink,
                        }], 
                    }] : [],
                })
                chatSchema.messages.push({ tgId: msg.message_id, discId: tempMsg.id, date: new Date() });
                await chatSchema.save();
            } catch(err) {
                console.error('Ошибка при отправке в Discord:', err);
            }
        }
    }
}

async function sendDiscordStickerToTelegram(message, telegramBot, chatId) {
    if (!message.stickers || message.stickers.size === 0) return;
  
    const sticker = message.stickers.first();
  
    // Проверим, поддерживается ли формат Telegram
    if (sticker.format !== 1) { // 1 = PNG/webp
      await telegramBot.telegram.sendMessage(chatId, `🧷 [Стикер: ${sticker.name} — формат ${sticker.format} не поддерживается Telegram]`);
      return;
    }
  
    try {
      // Получаем URL
      const url = sticker.url;
      const response = await axios.get(url, { responseType: 'arraybuffer' });
  
      // Сохраняем во временный файл
      const filePath = path.join(__dirname, `sticker_${sticker.id}.webp`);
      await fs.writeFile(filePath, response.data);
  
      // Отправляем стикер
      await telegramBot.telegram.sendSticker(chatId, { source: filePath });
  
      // Чистим
      await fs.remove(filePath);
    } catch (err) {
      console.error("❌ Ошибка загрузки стикера:", err.message);
      await telegramBot.telegram.sendMessage(chatId, `❌ Не удалось переслать стикер ${sticker.name}`);
    }
}

async function sendAllAttachments(message, telegramBot, chatId) {
    const attachments = [...message.attachments.values()];
    if (!attachments.length) return;
  
    const mediaGroup = [];
    const documents = [];
    let captionAdded = false;
  
    for (const att of attachments) {
      const url = att.url;
      const name = att.name || "file";
      const type = att.contentType || name;
  
      if (type.startsWith("image") || type.startsWith("video")) {
        mediaGroup.push({
          type: type.startsWith("image") ? "photo" : "video",
          media: url,
          ...( !captionAdded && message.content ? { caption: message.content } : {} )
        });
        captionAdded = true;
      } else {
        documents.push({
          url,
          name,
          caption: !captionAdded && message.content ? message.content : undefined
        });
        captionAdded = true;
      }
    }
  
    const chunks = chunkArray(mediaGroup, 10);
    for (const group of chunks) {
      await telegramBot.telegram.sendMediaGroup(chatId, group);
    }
  
    for (const doc of documents) {
      await telegramBot.telegram.sendDocument(chatId, { url: doc.url, filename: doc.name }, {
        caption: doc.caption
      });
    }
  }
  

function chunkArray(arr, size) {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
}

async function convertVoiceToMp3(fileUrl, outputName = 'voice') {
    const ogaPath = path.resolve(__dirname, `${outputName}.oga`);
    const mp3Path = path.resolve(__dirname, `${outputName}.mp3`);
  
    // Download .oga
    const res = await fetch(fileUrl);
    const fileStream = fs.createWriteStream(ogaPath);
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on('error', reject);
      fileStream.on('finish', resolve);
    });
  
    // Convert to .mp3
    return new Promise((resolve, reject) => {
      ffmpeg(ogaPath)
        .toFormat('mp3')
        .save(mp3Path)
        .on('end', () => {
          resolve(mp3Path); // path to converted file
        })
        .on('error', reject);
    });
}

async function sendGifToTelegram(bot, chatId, filePath, caption) {
  await bot.telegram.sendDocument(
    chatId,
    {
      source: filePath,
      filename: path.basename(filePath),
    },
    {
      caption: caption || '',
    }
  );
}

function getAvatarUrl(userId) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(userId)}&background=random&size=128`;
}

module.exports = messageCreate;