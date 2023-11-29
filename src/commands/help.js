function helpCommand(bot, message) {
    if (message.chat.type !== "private") {
        return;
    }

    const text =
        "Hello! I'm a bot programmed to send historical facts every day at the predetermined times of 8:00 am. \n\nIn addition, I have some amazing commands that may be useful for you. Feel free to interact with me and find out more about the world around us! \n\n<b>Just click on one of them:</b>";
    const options = {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "⁉️How to use / Command List",
                        callback_data: "commands",
                    },
                ],
                [
                    { text: "❔Projects", url: "https://t.me/Xmusicbots" },
                    { text: "❕Support", url: "https://t.me/x1botschat" },
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
                "/photoshist - Photos of historical facts 🙂",
                "/sendon - You will receive the daily message at 8 am",
                "/sendoff - You will not receive the daily message at 8 am",
            ];
            await bot.editMessageText(
                "<b>Command List:</b> \n\n" + commands.join("\n"),
                {
                    parse_mode: "HTML",
                    disable_web_page_preview: true,
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "Return",
                                    callback_data: "back_to_help",
                                },
                            ],
                        ],
                    },
                }
            );
        } else if (callbackQuery.data === "back_to_help") {
            await bot.editMessageText(text, {
                parse_mode: "HTML",
                chat_id: chatId,
                message_id: messageId,
                reply_markup: options.reply_markup,
            });
        }
    });

    bot.sendMessage(message.chat.id, text, options);
}

module.exports = {
    helpCommand,
};
