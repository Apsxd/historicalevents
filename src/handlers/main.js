const { bot } = require("../bot");
const axios = require("axios");
const cheerio = require("cheerio");
const CronJob = require("cron").CronJob;
const translate = require("translate-google");

const { ChatModel, UserModel } = require("../database");

const { startCommand } = require("../commands/start");
const { histimag } = require("../commands/histimag");
const { helpCommand } = require("../commands/help");

const groupId = process.env.groupId;
function is_dev(user_id) {
    const devUsers = process.env.DEV_USERS.split(",");
    return devUsers.includes(user_id.toString());
}
bot.onText(/^\/start$/, (message) => {
    startCommand(bot, message);
});

bot.onText(/^\/photoshist/, async (message) => {
    await histimag(bot, message);
});

bot.onText(/^\/help/, (message) => {
    helpCommand(bot, message);
});

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
        const developerMembers = msg.new_chat_members.filter(
            (member) => member.is_bot === false && is_dev(member.id)
        );

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

async function getHistoricalEvents() {
    const today = new Date();
    day = today.getDate();
    month = today.getMonth() + 1;

    const response = await axios.get(
        `https://www.educabras.com/hoje_na_historia/buscar/${day}/${month}`
    );
    const $ = cheerio.load(response.data);
    const eventDiv = $(".nascido_neste_dia");
    let eventText = eventDiv.text().trim();

    eventText = await translate(eventText, { to: "en" });

    return eventText;
}

async function sendHistoricalEventsGroup(chatId) {
    const events = await getHistoricalEvents();
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
        const message = `<b>TODAY IN HISTORY</b>\n\n📅 Event on <b>${day}/${month}</b>\n\n<i>${events}</i>`;
        const translatedMessage = await translate(message, { to: "en" });
        bot.sendMessage(chatId, translatedMessage, {
            parse_mode: "HTML",
            reply_markup: inlineKeyboard,
        });
    } else {
        const errorMessage = "<b>There are no historical events for today.</b>";
        const translatedErrorMessage = await translate(errorMessage, {
            to: "en",
        });
        bot.sendMessage(chatId, translatedErrorMessage, {
            parse_mode: "HTML",
            reply_markup: inlineKeyboard,
        });
    }
}

const morningJob = new CronJob(
    "0 8 * * *",
    async function () {
        const chatModels = await ChatModel.find({});
        for (const chatModel of chatModels) {
            const chatId = chatModel.chatId;
            if (chatId !== groupId) {
                await sendHistoricalEventsGroup(chatId);
                console.log(`Message sent successfully to group ${chatId}`);
            }
        }
    },
    null,
    true,
    "America/New_York"
);

morningJob.start();

const channelId = process.env.channelId;

async function sendHistoricalEventsChannel(channelId) {
    const events = await getHistoricalEvents();
    if (events) {
        const message = `<b>TODAY IN HISTORY</b>\n\n📅 Event on <b>${day}/${month}</b>\n\n<i>${events}</i>`;
        const translatedMessage = await translate(message, { to: "en" });
        bot.sendMessage(channelId, translatedMessage, {
            parse_mode: "HTML",
        });
    } else {
        const errorMessage = "<b>There are no historical events for today.</b>";
        const translatedErrorMessage = await translate(errorMessage, {
            to: "en",
        });
        bot.sendMessage(channelId, translatedErrorMessage, {
            parse_mode: "HTML",
        });
    }
}

const channelJob = new CronJob(
    "0 5 * * *",
    function () {
        sendHistoricalEventsChannel(channelId);
        console.log(`Message successfully sent to the channel ${channelId}`);
    },
    null,
    true,
    "America/New_York"
);

channelJob.start();

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

bot.onText(/^(\/broadcast|\/bc)\b/, async (msg, match) => {
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
    let sucess_br = 0;
    let no_sucess = 0;
    let block_num = 0;
    for (const { user_id } of ulist) {
        try {
            await bot.sendMessage(user_id, query_, {
                disable_web_page_preview: !web_preview,
                parse_mode: "HTML",
            });
            sucess_br += 1;
        } catch (err) {
            if (
                err.response &&
                err.response.body &&
                err.response.body.error_code === 403
            ) {
                block_num += 1;
            } else {
                no_sucess += 1;
            }
        }
    }
    await bot.editMessageText(
        `
  ╭─❑ 「 <b>Broadcast Completed</b> 」 ❑──
  │- <i>Total Users:</i> \`${ulist.length}\`
  │- <i>Successful:</i> \`${sucess_br}\`
  │- <i>Blocked:</i> \`${block_num}\`
  │- <i>Failed:</i> \`${no_sucess}\`
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

bot.onText(/\/block (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    if (msg.chat.type !== "private") {
        return bot.sendMessage(
            chatId,
            "This command can only be used in a private chat."
        );
    }

    if (!is_dev(msg.from.id)) {
        return bot.sendMessage(
            chatId,
            "You are not authorized to run this command."
        );
    }

    const chatIdToBlock = match[1];

    if (!chatIdToBlock) {
        return bot.sendMessage(
            chatId,
            "Please provide the ID of the chat you want to block."
        );
    }

    try {
        const chatModel = await ChatModel.findOne({ chatId: chatIdToBlock });
        if (!chatModel) {
            return bot.sendMessage(chatId, "Chat not found.");
        }

        chatModel.isBlocked = true;
        await chatModel.save();

        bot.sendMessage(chatId, `Chat ${chatIdToBlock} blocked successfully.`);
    } catch (error) {
        console.log(error);
        bot.sendMessage(chatId, "There was an error blocking the chat.");
    }
});

const channelStatusId = process.env.channelStatusId;

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

async function sendHistoricalEventsUser(userId) {
    const events = await getHistoricalEvents();
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
        const message = `<b>TODAY IN HISTORY</b>\n\n📅 Event on <b>${day}/${month}</b>\n\n<i>${events}</i>`;
        try {
            await bot.sendMessage(userId, message, {
                parse_mode: "HTML",
                reply_markup: inlineKeyboard,
            });
            console.log(`Message successfully sent to user ${userId}`);
        } catch (error) {
            console.log(
                `Error sending message to user ${userId}: ${error.message}`
            );
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
    } else {
        bot.sendMessage(
            userId,
            "<b>There are no historical events for today.</b>",
            {
                parse_mode: "HTML",
                reply_markup: inlineKeyboard,
            }
        );
    }
}

const userJob = new CronJob(
    "17 8 * * *",
    async function () {
        const users = await UserModel.find({ msg_private: true });
        for (const user of users) {
            const userId = user.user_id;
            await sendHistoricalEventsUser(userId);
        }
    },
    null,
    true,
    "America/New_York"
);

userJob.start();

bot.onText(/\/sendoff/, async (msg) => {
    if (msg.chat.type !== "private") {
        return;
    }
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = await UserModel.findOne({ user_id: userId });
    if (!user.msg_private) {
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
    if (user.msg_private) {
        bot.sendMessage(
            msg.chat.id,
            "You have already activated the function of receiving the message in the private chat."
        );
        return;
    }
    await UserModel.findOneAndUpdate(
        { user_id: userId },
        { msg_private: true },
        { new: true }
    );
    console.log(`User ${userId} updated to receive private message`);

    bot.sendMessage(
        msg.chat.id,
        "Private message enabled. You will receive message at 8 am every day about historical facts."
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
    "00 00 13 * * *",
    getDeathsOfTheDay,
    null,
    true,
    "America/New_York"
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
    "00 00 17 * * *",
    getBirthsOfTheDay,
    null,
    true,
    "America/New_York"
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
    "00 00 19 * * *",
    getHolidaysOfTheDay,
    null,
    true,
    "America/New_York"
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
        } else {
            await bot.sendMessage(channelId, caption);
        }

        console.log("Historical event sent successfully.");
    } catch (error) {
        console.error("Failed to send historical event:", error);
    }
}

const dar = new CronJob(
    "00 00 10 * * *",
    function () {
        sendHistoricalEvent();
    },
    null,
    true,
    "America/New_York"
);
dar.start();
