const { bot } = require("../bot");
const axios = require("axios");
const cheerio = require("cheerio");
const CronJob = require("cron").CronJob;

const { ChatModel, UserModel } = require("../database");

const { startCommand } = require("../commands/start");
const { helpCommand } = require("../commands/help");

const groupId = process.env.groupId;
const owner = process.env.ownerId
const channelId = process.env.channelId;
const channelStatusId = process.env.channelStatusId;

bot.onText(/^\/start$/, (message) => {
    startCommand(bot, message);
});

bot.onText(/^\/help/, (message) => {
    helpCommand(bot, message);
});

// Função para verificar se o usuário tem is_dev: true
async function is_dev(user_id) {
    try {
        const user = await UserModel.findOne({ user_id: user_id });
        if (user && user.is_dev === true) {
            return true;
        }
        return false;
    } catch (error) {
        console.error('Erro ao verificar is_dev:', error);
        return false;
    }
}

bot.onText(/^\/grupos/, async (message) => {
    const user_id = message.from.id;
    if (!(await is_dev(user_id))) {
        return;
    }
    if (message.chat.type !== "private") {
        return;
    }

    try {
        const chats = await ChatModel.find().sort({ chatId: 1 });

        let contador = 1;
        let chunkSize = 3900 - message.text.length;
        let messageChunks = [];
        let currentChunk = "";

        for (let chat of chats) {
            if (chat.chatId < 0) {
                let groupMessage = `<b>${contador}:</b> <b>Group=</b> ${chat.chatName} || <b>ID:</b> <code>${chat.chatId}</code>\n`;
                if (currentChunk.length + groupMessage.length > chunkSize) {
                    messageChunks.push(currentChunk);
                    currentChunk = "";
                }
                currentChunk += groupMessage;
                contador++;
            }
        }
        messageChunks.push(currentChunk);

        let index = 0;

        const markup = (index) => {
            return {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: `<< ${index + 1}`,
                                callback_data: `groups:${index - 1}`,
                                disabled: index === 0,
                            },
                            {
                                text: `>> ${index + 2}`,
                                callback_data: `groups:${index + 1}`,
                                disabled: index === messageChunks.length - 1,
                            },
                        ],
                    ],
                },
                parse_mode: "HTML",
            };
        };

        await bot.sendMessage(
            message.chat.id,
            messageChunks[index],
            markup(index)
        );

        bot.on("callback_query", async (query) => {
            if (query.data.startsWith("groups:")) {
                index = Number(query.data.split(":")[1]);
                if (
                    markup(index).reply_markup &&
                    markup(index).reply_markup.inline_keyboard
                ) {
                    markup(index).reply_markup.inline_keyboard[0][0].disabled =
                        index === 0;
                    markup(index).reply_markup.inline_keyboard[0][1].disabled =
                        index === messageChunks.length - 1;
                }
                await bot.editMessageText(messageChunks[index], {
                    chat_id: query.message.chat.id,
                    message_id: query.message.message_id,
                    ...markup(index),
                });
                await bot.answerCallbackQuery(query.id);
            }
        });
    } catch (error) {
        console.error(error);
    }
});

bot.onText(/\/adddev (\d+)/, async (msg, match) => {
    const user_id = msg.from.id;
    const userId = match[1];

    if (user_id.toString() !== owner) {
        await bot.sendMessage(
            msg.chat.id,
            "Você não está autorizado a executar este comando."
        );
        return;
    }

    if (msg.chat.type !== "private") {
        return;
    }

    const user = await UserModel.findOne({ user_id: userId });

    if (!user) {
        console.log("Nenhum Usuário encontrado com o ID informado.");
        return;
    }

    if (user.is_dev) {
        await bot.sendMessage(user_id, `O usuário ${userId} já é um dev.`);
        return;
    }

    await UserModel.updateOne({ user_id: userId }, { $set: { is_dev: true } });
    await bot.sendMessage(
        userId,
        `Parabéns! Você foi promovido a usuário dev. Agora você tem acesso a recursos especiais.`
    );
    await bot.sendMessage(user_id, `Usuário ${userId} foi promovido a dev.`);
});

bot.onText(/\/deldev (\d+)/, async (msg, match) => {
    const user_id = msg.from.id;
    const userId = match[1];

    if (user_id.toString() !== owner) {
        await bot.sendMessage(
            msg.chat.id,
            "Você não está autorizado a executar este comando."
        );
        return;
    }

    if (msg.chat.type !== "private") {
        return;
    }

    const user = await UserModel.findOne({ user_id: userId });

    if (!user) {
        console.log("Nenhum Usuário encontrado com o ID informado.");
        return;
    }

    if (!user.is_dev) {
        await bot.sendMessage(user_id, `O usuário ${userId} já não é um dev.`);
        return;
    }

    await UserModel.updateOne({ user_id: userId }, { $set: { is_dev: false } });
    await bot.sendMessage(
        userId,
        `Você não é mais um usuário dev. Seus acessos especiais foram revogados.`
    );
    await bot.sendMessage(user_id, `Usuário ${userId} não é mais um dev.`);
});

bot.on("message", async (msg) => {
    try {
        if (
            msg.chat.type === "private" &&
            msg.entities &&
            msg.entities[0].type === "bot_command"
        ) {
            const existingUser = await UserModel.findOne({
                user_id: msg.from.id,
            });
            if (existingUser) {
                return;
            }

            const user = new UserModel({
                user_id: msg.from.id,
                username: msg.from.username,
                firstname: msg.from.first_name,
                lastname: msg.from.last_name,
                msg_private: true,
            });

            await user.save();
            console.log(`User ${msg.from.id} saved in the database.`);

            const message = `#HistoricalEvents_bot #New_User
        <b>User:</b> <a href="tg://user?id=${user.user_id}">${user.firstname
                }</a>
        <b>ID:</b> <code>${user.user_id}</code>
        <b>Username:</b> ${user.username ? `@${user.username}` : "Uninformed"}`;
            bot.sendMessage(groupId, message, { parse_mode: "HTML" });
        }
    } catch (error) {
        console.error(
            `Error saving user ${msg.from.id} in the database: ${error.message}`
        );
    }
});

bot.on("polling_error", (error) => {
    console.error(error);
});

bot.on("new_chat_members", async (msg) => {
    const chatId = msg.chat.id;
    const chatName = msg.chat.title;

    try {
        const chat = await ChatModel.findOne({ chatId: chatId });

        if (chat) {
            console.log(
                `Group ${chatName} (${chatId}) already exists in the database`
            );
        } else if (chatId === groupId) {
            console.log(
                `The chatId ${chatId} is equal to groupId ${groupId}. It will not be saved in the database.`
            );
        } else {
            if (chatId === groupId) {
                return;
            }
            const newChat = await ChatModel.create({ chatId, chatName });
            console.log(
                `Group ${newChat.chatName} (${newChat.chatId}) added to database`
            );

            const botUser = await bot.getMe();
            const newMembers = msg.new_chat_members.filter(
                (member) => member.id === botUser.id
            );

            if (msg.chat.username) {
                chatusername = `@${msg.chat.username}`;
            } else {
                chatusername = "Private Group";
            }

            if (newMembers.length > 0) {
                const message = `#HistoricalEvents_bot #New_Group
            <b>Group:</b> ${chatName}
            <b>ID:</b> <code>${chatId}</code>
            <b>Link:</b> ${chatusername}`;

                bot.sendMessage(groupId, message, { parse_mode: "HTML" }).catch(
                    (error) => {
                        console.error(
                            `Error sending message to group ${chatId}: ${error}`
                        );
                    }
                );
            }

            bot.sendMessage(
                chatId,
                "Hello, my name is Historical Events! Thank you for adding me to your group.\n\nI will message you every day at 8 am and have some commands.",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "Official Channel 🇺🇸",
                                    url: "https://t.me/today_in_historys",
                                },
                            ],
                            [
                                {
                                    text: "Report bugs",
                                    url: "https://t.me/kylorensbot",
                                },
                            ],
                        ],
                    },
                }
            );
        }

        try {
            const developerMembers = await Promise.all(msg.new_chat_members.map(async (member) => {
                if (member.is_bot === false && await is_dev(member.id)) {
                    const user = await UserModel.findOne({ user_id: member.id });
                    if (user && user.is_dev === true) {
                        return member;
                    }
                }
            }));


            if (developerMembers.length > 0) {
                const message = `👨‍💻 <b>ᴏɴᴇ ᴏғ ᴍʏ ᴅᴇᴠᴇʟᴏᴘᴇʀs ᴊᴏɪɴᴇᴅ ᴛʜᴇ ɢʀᴏᴜᴘ</b> <a href="tg://user?id=${developerMembers[0].id}">${developerMembers[0].first_name}</a> 😎👍`;
                bot.sendMessage(chatId, message, { parse_mode: "HTML" }).catch(
                    (error) => {
                        console.error(
                            `Error sending message to group ${chatId}: ${error}`
                        );
                    }
                );
            }
        } catch (err) {
            console.error(err);
        }
    } catch (err) {
        console.error(err);
    }
});

bot.on("left_chat_member", async (msg) => {
    const botUser = await bot.getMe();
    if (msg.left_chat_member.id === botUser.id && msg.chat.id === groupId) {
        console.log("Bot left the group!");

        try {
            const chatId = msg.chat.id;
            const chat = await ChatModel.findOneAndDelete({ chatId });
            console.log(
                `Group ${chat.chatName} (${chat.chatId}) removed from database`
            );
        } catch (err) {
            console.error(err);
        }
    }
});

let day, month;

async function getHistoricalEventsGroup(chatId) {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;

    try {
        const jsonEvents = require("../collections/events.json");
        const events = jsonEvents[`${month}-${day}`];

        const inlineKeyboard = {
            inline_keyboard: [
                [
                    {
                        text: "📢 Official Channel",
                        url: "https://t.me/today_in_historys",
                    },
                ],
            ],
        };

        if (events) {
            let message = `<b>TODAY IN HISTORY</b>\n\n📅 Events on <b>${day}/${month}</b>\n\n`;
            for (const event of events) {
                message += `<i>${event}</i>\n\n`;
            }
            await bot.sendMessage(chatId, message, {
                parse_mode: "HTML",
                reply_markup: inlineKeyboard,
            });
            console.log(`Message sent successfully to group ${chatId}`);
        } else {
            const errorMessage = "<b>There are no historical events for today.</b>";
            await bot.sendMessage(chatId, errorMessage, {
                parse_mode: "HTML",
                reply_markup: inlineKeyboard,
            });
            console.log(`Empty message sent to group ${chatId}`);
        }
    } catch (error) {
        console.error(`Error sending message to group ${chatId}:`, error);
        if (error.response && error.response.statusCode === 403) {
            await ChatModel.findOneAndUpdate(
                { chatId: chatId },
                { subscribed: false }
            );
            console.log(
                `User ${chatId} has blocked the bot and has been unsubscribed from private messages`
            );
        }
    }
}

const morningJob = new CronJob(
    "00 00 9 * * *",
    async function () {
        try {
            const chatModels = await ChatModel.find({});
            for (const chatModel of chatModels) {
                const chatId = chatModel.chatId;
                if (chatId !== groupId) {
                    await getHistoricalEventsGroup(chatId);
                }
            }
        } catch (error) {
            console.error("Error retrieving chat models:", error);
        }
    },
    null,
    true,
    "America/Sao_Paulo"
);

morningJob.start();




async function getHistoricalEvents() {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;

    try {
        const jsonEvents = require("../collections/events.json");
        const events = jsonEvents[`${month}-${day}`];

        if (events) {
            let message = `<b>TODAY IN HISTORY</b>\n\n📅 Events on <b>${day}/${month}</b>\n\n`;
            for (const event of events) {
                message += `<i>${event}</i>\n\n`;
            }
            await sendMessageToChannel(message);
        } else {
            console.log("No information available for today's date.");
        }
    } catch (error) {
        console.error("Error retrieving information:", error.message);
    }
}

const channel = new CronJob(
    "00 00 06 * * *",
    getHistoricalEvents,
    null,
    true,
    "America/Sao_Paulo"
);
channel.start();

async function sendHistoricalEventsUser(userId) {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;

    try {
        const jsonEvents = require("../collections/events.json");
        const events = jsonEvents[`${month}-${day}`];
        const inlineKeyboard = {
            inline_keyboard: [
                [
                    {
                        text: "📢 Official Channel",
                        url: "https://t.me/today_in_historys",
                    },
                ],
            ],
        };

        if (events) {
            let message = `<b>TODAY IN HISTORY</b>\n\n📅 Events on <b>${day}/${month}</b>\n\n`;
            for (const event of events) {
                message += `<i>${event}</i>\n\n`;
            }
            await bot.sendMessage(userId, message, {
                parse_mode: "HTML",
                reply_markup: inlineKeyboard,
            });
            console.log(`Message successfully sent to user ${userId}`);
        } else {
            const errorMessage = "<b>There are no historical events for today.</b>";
            await bot.sendMessage(userId, errorMessage, {
                parse_mode: "HTML",
                reply_markup: inlineKeyboard,
            });
            console.log(`Empty message sent to user ${userId}`);
        }
    } catch (error) {
        console.log(`Error sending message to user ${userId}: ${error.message}`);
        if (error.response && error.response.statusCode === 403) {
            await UserModel.findOneAndUpdate(
                { user_id: userId },
                { msg_private: false }
            );
            console.log(
                `User ${userId} has blocked the bot and been unsubscribed from private messages`
            );
        }
    }
}

const userJob = new CronJob(
    "00 18 10 * * *",
    async function () {
        try {
            const users = await UserModel.find({ msg_private: true });
            for (const user of users) {
                const userId = user.user_id;
                try {
                    await sendHistoricalEventsUser(userId);
                } catch (error) {
                    console.log(`Error processing user ${userId}: ${error.message}`);
                }
            }
        } catch (error) {
            console.error("Error retrieving user models:", error);
        }
    },
    null,
    true,
    "America/Sao_Paulo"
);

userJob.start();



bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const numUsers = await UserModel.countDocuments();
    const numChats = await ChatModel.countDocuments();

    const message = `\n──❑ 「 Bot Stats 」 ❑──\n\n ☆ ${numUsers} users\n ☆ ${numChats} chats`;
    bot.sendMessage(chatId, message);
});
bot.on("polling_error", (error) => {
    console.error(`Polling bot error: ${error}`);
});

function timeFormatter(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const hoursFormatted = String(hours).padStart(2, "0");
    const minutesFormatted = String(minutes).padStart(2, "0");
    const secondsFormatted = String(secs).padStart(2, "0");

    return `${hoursFormatted}:${minutesFormatted}:${secondsFormatted}`;
}

bot.onText(/\/ping/, async (msg) => {
    const start = new Date();
    const replied = await bot.sendMessage(msg.chat.id, "𝚙𝚘𝚗𝚐!");
    const end = new Date();
    const m_s = end - start;
    const uptime = process.uptime();
    const uptime_formatted = timeFormatter(uptime);
    await bot.editMessageText(
        `𝚙𝚒𝚗𝚐: \`${m_s}𝚖𝚜\`\n𝚞𝚙𝚝𝚒𝚖𝚎: \`${uptime_formatted}\``,
        {
            chat_id: replied.chat.id,
            message_id: replied.message_id,
            parse_mode: "Markdown",
        }
    );
});

bot.onText(/^\/broadcast\b/, async (msg, match) => {
    const user_id = msg.from.id;
    if (!(await is_dev(user_id))) {
        return;
    }
    if (msg.chat.type !== "private") {
        return;
    }

    const query = match.input.substring(match[0].length).trim();
    if (!query) {
        return bot.sendMessage(
            msg.chat.id,
            "<i>I need text to broadcast.</i>",
            { parse_mode: "HTML" }
        );
    }
    const sentMsg = await bot.sendMessage(msg.chat.id, "<i>Processing...</i>", {
        parse_mode: "HTML",
    });
    const web_preview = query.startsWith("-d");
    const query_ = web_preview ? query.substring(2).trim() : query;
    const ulist = await UserModel.find().lean().select("user_id");
    let success_br = 0;
    let no_success = 0;
    let block_num = 0;
    for (const { user_id } of ulist) {
        try {
            await bot.sendMessage(user_id, query_, {
                disable_web_page_preview: !web_preview,
                parse_mode: "HTML",
            });
            success_br += 1;
        } catch (err) {
            if (
                err.response &&
                err.response.body &&
                err.response.body.error_code === 403
            ) {
                block_num += 1;
            } else {
                no_success += 1;
            }
        }
    }
    await bot.editMessageText(
        `
    ╭─❑ 「 <b>Broadcast Completed</b> 」 ❑──
    │- <i>Total Users:</i> \`${ulist.length}\`
    │- <i>Successful:</i> \`${success_br}\`
    │- <i>Blocked:</i> \`${block_num}\`
    │- <i>Failed:</i> \`${no_success}\`
    ╰❑
      `,
        {
            chat_id: sentMsg.chat.id,
            message_id: sentMsg.message_id,
            parse_mode: "HTML",
        }
    );
});


bot.onText(/^\/bc\b/, async (msg, match) => {
    const user_id = msg.from.id;
    if (!(await is_dev(user_id))) {
        return;
    }
    if (msg.chat.type !== "private") {
        return;
    }

    const sentMsg = await bot.sendMessage(msg.chat.id, "<i>Processing...</i>", {
        parse_mode: "HTML",
    });
    const web_preview = match.input.startsWith("-d");
    const query = web_preview ? match.input.substring(4).trim() : match.input;
    const ulist = await UserModel.find().lean().select("user_id");
    let success_br = 0;
    let no_success = 0;
    let block_num = 0;

    if (msg.reply_to_message) {
        const replyMsg = msg.reply_to_message;
        for (const { user_id } of ulist) {
            try {
                await bot.forwardMessage(
                    user_id,
                    replyMsg.chat.id,
                    replyMsg.message_id
                );
                success_br += 1;
            } catch (err) {
                if (
                    err.response &&
                    err.response.body &&
                    err.response.body.error_code === 403
                ) {
                    block_num += 1;
                } else {
                    no_success += 1;
                }
            }
        }
    } else {
        for (const { user_id } of ulist) {
            try {
                await bot.sendMessage(user_id, query, {
                    disable_web_page_preview: !web_preview,
                    parse_mode: "HTML",
                    reply_to_message_id: msg.message_id,
                });
                success_br += 1;
            } catch (err) {
                if (
                    err.response &&
                    err.response.body &&
                    err.response.body.error_code === 403
                ) {
                    block_num += 1;
                } else {
                    no_success += 1;
                }
            }
        }
    }

    await bot.editMessageText(
        `
  ╭─❑ 「 <b>Broadcast Completed</b> 」 ❑──
  │- <i>Total User:</i> \`${ulist.length}\`
  │- <i>Successful:</i> \`${success_br}\`
  │- <i>Blocked:</i> \`${block_num}\`
  │- <i>Failed:</i> \`${no_success}\`
  ╰❑
    `,
        {
            chat_id: sentMsg.chat.id,
            message_id: sentMsg.message_id,
            parse_mode: "HTML",
        }
    );
});


bot.onText(/\/dev/, async (message) => {
    const userId = message.from.id;
    if (message.chat.type !== "private") {
        return;
    }
    const firstName = message.from.first_name;
    const message_start_dev = `Hello, <b>${firstName}</b>! You are one of the developers 🧑‍💻\n\nYou are on Janna's developer dashboard, so take responsibility and use commands with conscience`;
    const options_start_dev = {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "📬 Official Channel",
                        url: "https://t.me/today_in_historys",
                    },
                ],
                [
                    {
                        text: "🗃 List of commands for developerss",
                        callback_data: "commands",
                    },
                ],
            ],
        },
    };
    bot.on("callback_query", async (callbackQuery) => {
        if (callbackQuery.message.chat.type !== "private") {
            return;
        }
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;

        if (callbackQuery.data === "commands") {
            const commands = [
                "/stats - Statistics of groups, messages and sent users",
                "/broadcast or /bc - send message to all users",
                "/ping - see VPS latency",
                "/block - blocks a chat from receiving the message",
                "/groups - lists all groups in the db",
                "/sendgp - encaminha msg para grupos",
            ];
            await bot.editMessageText(
                "<b>List of Commands:</b> \n\n" + commands.join("\n"),
                {
                    parse_mode: "HTML",
                    disable_web_page_preview: true,
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "⬅️ Return",
                                    callback_data: "back_to_start",
                                },
                            ],
                        ],
                    },
                }
            );
        } else if (callbackQuery.data === "back_to_start") {
            await bot.editMessageText(message_start_dev, {
                parse_mode: "HTML",
                chat_id: chatId,
                message_id: messageId,
                disable_web_page_preview: true,
                reply_markup: options_start_dev.reply_markup,
            });
        }
    });
    if (is_dev(userId)) {
        bot.sendMessage(userId, message_start_dev, options_start_dev);
    } else {
        bot.sendMessage(message.chat.id, "You are not a developer");
    }
});

bot.onText(/\/devs/, async (message) => {
    const chatId = message.chat.id;
    const userId = message.from.id;

    if (!(await is_dev(userId))) {
        bot.sendMessage(
            chatId,
            "Este comando só pode ser usado por desenvolvedores!"
        );
        return;
    }

    if (message.chat.type !== "private" || chatId !== userId) {
        bot.sendMessage(
            chatId,
            "Este comando só pode ser usado em um chat privado com o bot!"
        );
        return;
    }

    try {
        const devsData = await UserModel.find({ is_dev: true });

        let message = "<b>Lista de desenvolvedores:</b>\n\n";
        for (let user of devsData) {
            const { firstname, user_id } = user;
            message += `<b>User:</b> ${firstname} ||`;
            message += `<b> ID:</b> <code>${user_id}</code>\n`;
        }

        bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    } catch (error) {
        console.error(error);
        bot.sendMessage(
            chatId,
            "Ocorreu um erro ao buscar a lista de desenvolvedores!"
        );
    }
});

bot.onText(/\/ban/, async (message) => {
    const userId = message.from.id;
    const chatId = message.text.split(" ")[1];

    if (message.chat.type !== "private") {
        await bot.sendMessage(
            message.chat.id,
            "Por favor, envie este comando em um chat privado com o bot."
        );
        return;
    }

    if (!(await is_dev(user_id))) {
        await bot.sendMessage(
            message.chat.id,
            "Você não está autorizado a executar este comando."
        );
        return;
    }

    const chat = await ChatModel.findOne({ chatId: chatId });

    if (!chat) {
        console.log("Nenhum grupo encontrado com o ID informado.");
        return;
    }

    if (chat.isBlocked) {
        await bot.sendMessage(
            message.chat.id,
            `Grupo ${chat.chatName} já foi banido.`
        );
        return;
    }

    let chatUsername;
    if (message.chat.username) {
        chatUsername = `@${message.chat.username}`;
    } else {
        chatUsername = "Private Group";
    }
    const banMessage = `#${nameBot} #Banned
    <b>Group:</b> ${chat.chatName}
    <b>ID:</b> <code>${chatId}</code>
    <b>Dev:</b> ${chatUsername}`;

    bot.sendMessage(groupId, banMessage, { parse_mode: "HTML" }).catch(
        (error) => {
            console.error(
                `Erro ao enviar mensagem para o grupo ${chatId}: ${error}`
            );
        }
    );

    await ChatModel.updateOne({ chatId: chatId }, { $set: { isBlocked: true } });
    await bot.sendMessage(chatId, `Toguro sairá do grupo e não pode ficar!!`);
    await bot.leaveChat(chatId);

    await bot.sendMessage(
        message.chat.id,
        `Grupo ${chat.chatName} de ID: ${chatId} foi banido com sucesso.`
    );
});

bot.onText(/\/unban/, async (message) => {
    const userId = message.from.id;
    const chatId = message.text.split(" ")[1];

    if (message.chat.type !== "private") {
        await bot.sendMessage(
            message.chat.id,
            "Por favor, envie este comando em um chat privado com o bot."
        );
        return;
    }

    if (!(await is_dev(userId))) {
        await bot.sendMessage(
            message.chat.id,
            "Você não está autorizado a executar este comando."
        );
        return;
    }

    const chat = await ChatModel.findOne({ chatId: chatId });

    if (!chat) {
        await bot.sendMessage(
            message.chat.id,
            `Nenhum grupo encontrado com o ID ${chatId}.`
        );
        return;
    }

    if (!chat.isBlocked) {
        await bot.sendMessage(
            message.chat.id,
            `O grupo ${chat.chatName} já está desbanido ou nunca foi banido.`
        );
        return;
    }

    let devUsername;
    if (message.chat.username) {
        devUsername = `@${message.chat.username}`;
    } else {
        devUsername = "Private Group";
    }
    const banMessage = `#${nameBot} #Unban
    <b>Group:</b> ${chat.chatName}
    <b>ID:</b> <code>${chatId}</code>
    <b>Dev:</b> ${devUsername}`;

    bot.sendMessage(groupId, banMessage, { parse_mode: "HTML" }).catch(
        (error) => {
            console.error(
                `Erro ao enviar mensagem para o grupo ${chatId}: ${error}`
            );
        }
    );

    await ChatModel.updateOne({ chatId: chatId }, { $set: { isBlocked: false } });
    await bot.sendMessage(
        message.chat.id,
        `Grupo ${chat.chatName} foi desbanido.`
    );
});


bot.onText(/\/banned/, async (message) => {
    const userId = message.from.id;

    if (message.chat.type !== "private") {
        await bot.sendMessage(
            message.chat.id,
            "Por favor, envie este comando em um chat privado com o bot."
        );
        return;
    }

    if (!(await is_dev(userId))) {
        await bot.sendMessage(
            message.chat.id,
            "Você não está autorizado a executar este comando."
        );
        return;
    }

    const bannedChats = await ChatModel.find({ isBlocked: true });

    if (bannedChats.length === 0) {
        await bot.sendMessage(
            message.chat.id,
            "Nenhum chat encontrado no banco de dados que tenha sido banido."
        );
        return;
    }

    let contador = 1;
    let chunkSize = 3900;
    let messageChunks = [];
    let currentChunk = "<b>Chats banidos:</b>\n";

    for (const chat of bannedChats) {
        const groupMessage = `<b>${contador}:</b> <b>Group:</b> <a href="tg://resolve?domain=${chat.chatName}&amp;id=${chat.chatId}">${chat.chatName}</a> || <b>ID:</b> <code>${chat.chatId}</code>\n`;
        if (currentChunk.length + groupMessage.length > chunkSize) {
            messageChunks.push(currentChunk);
            currentChunk = "";
        }
        currentChunk += groupMessage;
        contador++;
    }
    messageChunks.push(currentChunk);

    let index = 0;

    const markup = (index) => {
        return {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: `<< ${index + 1}`,
                            callback_data: `banned:${index - 1}`,
                            disabled: index === 0,
                        },
                        {
                            text: `>> ${index + 2}`,
                            callback_data: `banned:${index + 1}`,
                            disabled: index === messageChunks.length - 1,
                        },
                    ],
                ],
            },
            parse_mode: "HTML",
        };
    };

    await bot.sendMessage(message.chat.id, messageChunks[index], markup(index));

    bot.on("callback_query", async (query) => {
        if (query.data.startsWith("banned:")) {
            index = Number(query.data.split(":")[1]);
            if (
                markup(index).reply_markup &&
                markup(index).reply_markup.inline_keyboard
            ) {
                markup(index).reply_markup.inline_keyboard[0][0].disabled =
                    index === 0;
                markup(index).reply_markup.inline_keyboard[0][1].disabled =
                    index === messageChunks.length - 1;
            }
            await bot.editMessageText(messageChunks[index], {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                ...markup(index),
            });
            await bot.answerCallbackQuery(query.id);
        }
    });
});


async function sendStatus() {
    const start = new Date();
    const replied = await bot.sendMessage(channelStatusId, "Bot is ON");
    const end = new Date();
    const m_s = end - start;
    const uptime = process.uptime();
    const uptime_formatted = timeFormatter(uptime);
    const numUsers = await UserModel.countDocuments();
    const numChats = await ChatModel.countDocuments();
    await bot.editMessageText(
        `#Historicaleventsbot #Status\n\nStatus: ON\nPing: \`${m_s}ms\`\nUptime: \`${uptime_formatted}\`\nUsers: \`${numUsers}\`\nChats: \`${numChats}\``,
        {
            chat_id: replied.chat.id,
            message_id: replied.message_id,
            parse_mode: "Markdown",
        }
    );
}

function timeFormatter(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const hoursFormatted = String(hours).padStart(2, "0");
    const minutesFormatted = String(minutes).padStart(2, "0");
    const secondsFormatted = String(secs).padStart(2, "0");

    return `${hoursFormatted}:${minutesFormatted}:${secondsFormatted}`;
}

const job = new CronJob(
    "04 00 12 * * *",
    sendStatus,
    null,
    true,
    "America/Sao_Paulo"
);

bot.onText(/\/sendoff/, async (msg) => {
    if (msg.chat.type !== "private") {
        return;
    }
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = await UserModel.findOne({ user_id: userId });
    if (!user) {
        bot.sendMessage(
            msg.chat.id,
            "User not found. Please register first."
        );
        return;
    }

    if (user.msg_private) {
        bot.sendMessage(
            chatId,
            "You have already deactivated the function of receiving the message in the private chat."
        );
        return;
    }
    await UserModel.findOneAndUpdate(
        { user_id: userId },
        { msg_private: false },
        { new: true }
    );
    console.log(`User ${userId} updated to not receive private message`);

    bot.sendMessage(
        chatId,
        "Private messages disabled. You will not receive a message at 8 am every day."
    );
});

bot.onText(/\/sendon/, async (msg) => {
    if (msg.chat.type !== "private") {
        return;
    }
    const userId = msg.from.id;
    const user = await UserModel.findOne({ user_id: userId });

    if (!user) {
        bot.sendMessage(
            msg.chat.id,
            "User not found. Please register first."
        );
        return;
    }

    if (user.msg_private) {
        bot.sendMessage(
            msg.chat.id,
            "You have already activated the function of receiving messages in private chat."
        );
        return;
    }

    await UserModel.findOneAndUpdate(
        { user_id: userId },
        { msg_private: true },
        { new: true }
    );

    console.log(`User ${userId} updated to receive private messages`);

    bot.sendMessage(
        msg.chat.id,
        "Private messages enabled. You will receive messages at 8 am every day about historical facts."
    );
});


bot.onText(/\/sendgp/, async (msg, match) => {
    const user_id = msg.from.id;
    if (!(await is_dev(user_id))) {
        return;
    }
    if (msg.chat.type !== "private") {
        return;
    }

    const sentMsg = await bot.sendMessage(msg.chat.id, "<i>Processing...</i>", {
        parse_mode: "HTML",
    });
    const web_preview = match.input.startsWith("-d");
    const query = web_preview ? match.input.substring(6).trim() : match.input;
    const ulist = await ChatModel.find().lean().select("chatId");
    let success_br = 0;
    let no_success = 0;
    let block_num = 0;

    if (msg.reply_to_message) {
        const replyMsg = msg.reply_to_message;
        for (const { chatId } of ulist) {
            try {
                await bot.forwardMessage(
                    chatId,
                    replyMsg.chat.id,
                    replyMsg.message_id
                );
                success_br += 1;
            } catch (err) {
                if (
                    err.response &&
                    err.response.body &&
                    err.response.body.error_code === 403
                ) {
                    block_num += 1;
                } else {
                    no_success += 1;
                }
            }
        }
    } else {
        for (const { chatId } of ulist) {
            try {
                await bot.sendMessage(chatId, query, {
                    disable_web_page_preview: !web_preview,
                    parse_mode: "HTML",
                    reply_to_message_id: msg.message_id,
                });
                success_br += 1;
            } catch (err) {
                if (
                    err.response &&
                    err.response.body &&
                    err.response.body.error_code === 403
                ) {
                    block_num += 1;
                } else {
                    no_success += 1;
                }
            }
        }
    }

    await bot.editMessageText(
        `
  ╭─❑ 「 <b>Broadcast Completed</b> 」 ❑──
  │- <i>Total Group:</i> \`${ulist.length}\`
  │- <i>Successful:</i> \`${success_br}\`
  │- <i>Removed:</i> \`${block_num}\`
  │- <i>Failed:</i> \`${no_success}\`
  ╰❑
    `,
        {
            chat_id: sentMsg.chat.id,
            message_id: sentMsg.message_id,
            parse_mode: "HTML",
        }
    );
});

exports.initHandler = () => {
    return bot;
};

async function sendMessageToChannel(message) {
    try {
        await bot.sendMessage(channelId, message, { parse_mode: "HTML" });
        console.log("Mensagem enviada com sucesso!");
    } catch (error) {
        console.error("Erro ao enviar mensagem:", error.message);
    }
}

async function getDeathsOfTheDay() {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;

    try {
        const response = await axios.get(
            `https://en.wikipedia.org/api/rest_v1/feed/onthisday/deaths/${month}/${day}`,
            {
                headers: {
                    accept: 'application/json; charset=utf-8; profile="https://www.mediawiki.org/wiki/Specs/onthisday/0.3.3"',
                },
            }
        );

        if (response.data.deaths.length > 0) {
            const deaths = response.data.deaths.slice(0, 5);
            const messageParts = [];

            deaths.forEach((death, index) => {
                const name = `<b>${death.text}</b>`;
                const info =
                    death.pages?.[0]?.extract || "Information not available.";
                const date = death.year || "unknown date.";
                const deathMessage = `<i>${index + 1
                    }.</i> <b>Name:</b> ${name}\n<b>Information:</b> ${info}\n<b>Date of death:</b> ${date}`;
                messageParts.push(deathMessage);
            });

            let message =
                "<b>ℹ️ Information about the dead of the day:</b>\n\n";

            message += messageParts.join("\n\n");

            message += "\n\n⚰️ Did you know that?";

            await sendMessageToChannel(message);
        } else {
            console.log(
                "There is no information about dead for the current day."
            );
        }
    } catch (error) {
        console.error("Error getting information:", error.message);
    }
}

const death = new CronJob(
    "00 30 14 * * *",
    getDeathsOfTheDay,
    null,
    true,
    "America/Sao_Paulo"
);
death.start();

async function getBirthsOfTheDay() {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;

    try {
        const response = await axios.get(
            `https://en.wikipedia.org/api/rest_v1/feed/onthisday/births/${month}/${day}`,
            {
                headers: {
                    accept: 'application/json; charset=utf-8; profile="https://www.mediawiki.org/wiki/Specs/onthisday/0.3.3"',
                },
            }
        );

        if (response.data.births.length > 0) {
            const births = response.data.births.slice(0, 5);
            const messageParts = [];

            births.forEach((birth, index) => {
                const name = `<b>${birth.text}</b>`;
                const info =
                    birth.pages?.[0]?.extract || "Information not available.";
                const date = birth.year || "Date unknown.";
                const birthMessage = `<i>${index + 1
                    }.</i> <b>Name:</b> ${name}\n<b>Information:</b> ${info}\n<b>Date of birth:</b> ${date}`;
                messageParts.push(birthMessage);
            });

            let message = "<b>ℹ️ Information about those born today:</b>\n\n";

            message += messageParts.join("\n\n");

            message += "\n\n🎂 Did you know that?";

            await sendMessageToChannel(message);
        } else {
            console.log("There is no information about born today.");
        }
    } catch (error) {
        console.error("Error getting information:", error.message);
    }
}

const birth = new CronJob(
    "00 00 19 * * *",
    getBirthsOfTheDay,
    null,
    true,
    "America/Sao_Paulo"
);
birth.start();

async function getHolidaysOfTheDay() {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;

    try {
        const response = await axios.get(
            `https://en.wikipedia.org/api/rest_v1/feed/onthisday/holidays/${month}/${day}`,
            {
                headers: {
                    accept: 'application/json; charset=utf-8; profile="https://www.mediawiki.org/wiki/Specs/onthisday/0.3.3"',
                },
            }
        );

        if (response.data.holidays.length > 0) {
            const holidays = response.data.holidays.slice(0, 5);
            const messageParts = [];

            holidays.forEach((holiday, index) => {
                const name = `<b>${holiday.text}</b>`;
                const info =
                    holiday.pages?.[0]?.extract || "Information not available.";
                const holidayMessage = `<i>${index + 1
                    }.</i> <b>Name:</b> ${name}\n<b>Information:</b> ${info}`;
                messageParts.push(holidayMessage);
            });

            let message =
                "<b>ℹ️ Information about the day's world holidays:</b>\n\n";

            message += messageParts.join("\n\n");

            message += "\n\n🌍 Did you know that?";

            await sendMessageToChannel(message);
        } else {
            console.log(
                "There is no information on world holidays for the current day."
            );
        }
    } catch (error) {
        console.error("Error getting information:", error.message);
    }
}

const holiday = new CronJob(
    "00 00 21 * * *",
    getHolidaysOfTheDay,
    null,
    true,
    "America/Sao_Paulo"
);
holiday.start();

async function sendHistoricalEvent() {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;

    try {
        const response = await axios.get(
            `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`
        );
        const events = response.data.events;
        const randomIndex = Math.floor(Math.random() * events.length);
        const event = events[randomIndex];

        const caption = event.text;
        if (event.pages && event.pages[0].thumbnail) {
            const photoUrl = event.pages[0].thumbnail.source;
            await bot.sendPhoto(channelId, photoUrl, { caption });
        }

        console.log("Historical event sent successfully.");
    } catch (error) {
        console.error("Failed to send historical event:", error);
    }
}

const dar = new CronJob(
    "00 00 12 * * *",
    function () {
        sendHistoricalEvent();
    },
    null,
    true,
    "America/Sao_Paulo"
);
dar.start();

const tas = new CronJob(
    "00 00 08 * * *",
    function () {
        sendHistoricalEvent();
    },
    null,
    true,
    "America/Sao_Paulo"
);
tas.start();

const fars = new CronJob(
    "00 00 15 * * *",
    function () {
        sendHistoricalEvent();
    },
    null,
    true,
    "America/Sao_Paulo"
);
fars.start();
