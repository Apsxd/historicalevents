function startCommand(bot, message) {
    if (message.chat.type !== "private") {
        return;
    }
    const firstName = message.from.first_name;

    const message_start = `Hello, <b>${firstName}</b>! \n\nI am <b>Historical Events</b>, I am a bot that sends a daily message with historical events followed on the day the message was sent. \n\nAdd me to your group.\n\n📢 <b>Official Channel:</b> <a href="https://t.me/today_in_historys">Today in History</a>\n📢 Command /help`;
    const options_start = {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "✨ Add me in your group",
                        url: "https://t.me/fatoshistbot?startgroup=true",
                    },
                ],
                [
                    {
                        text: "👾 Stickers Channel",
                        url: "https://t.me/lbrabo",
                    },
                    {
                        text: "💰 Make a donation",
                        callback_data: "donate",
                    },
                ],
                [
                    {
                        text: "Official Channel 🇺🇸",
                        url: "https://t.me/today_in_historys",
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

        if (callbackQuery.data === "donate") {
            const resposta_donate = `Hello, ${firstName}! \n\nContribute any amount to help keep the bot's server online and with more resources! Your help is essential for us to keep the bot running efficiently and with new features. \n\nTo make a donation\n\nThank you for your contribution! 🙌\n\n<b>BTC:</b> <code>bc1qjxzlug0cwnfjrhacy9kkpdzxfj0mcxc079axtl</code>\n<b>ETH/USDT:</b> <code>0x1fbde0d2a96869299049f4f6f78fbd789d167d1b</code>`;

            await bot.editMessageText(resposta_donate, {
                parse_mode: "HTML",
                disable_web_page_preview: true,
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "Return",
                                callback_data: "back_to_start",
                            },
                        ],
                    ],
                },
            });
        } else if (callbackQuery.data === "back_to_start") {
            await bot.editMessageText(message_start, {
                parse_mode: "HTML",
                chat_id: chatId,
                message_id: messageId,
                disable_web_page_preview: true,
                reply_markup: options_start.reply_markup,
            });
        }
    });
    bot.sendMessage(message.chat.id, message_start, options_start);
}

module.exports = {
    startCommand,
};
