const historicos = [
    {
        titulo: "A San Francisco police officer scolds a man for not wearing a mask during the 1918 flu pandemic © California State Library",
        imagem: "https://i.imgur.com/8Q9OC3d.jpeg",
    },
    {
        titulo: "Family and friends visiting quarantined patients at Ullevål hospital in Oslo, Norway, 1905 © Anders Beer Wilse",
        imagem: "https://i.imgur.com/ifSFlsp.jpeg",
    },
    {
        titulo: "Celebration of the liberation of the Auschwitz concentration camp in Poland by the Soviet army in 1945",
        imagem: "https://i.imgur.com/ksdeCm1.png",
    },
    {
        titulo: "Survivors of the famous plane crash in the Andes in 1972, when people had to resort to cannibalism to survive for 72 days in the snow",
        imagem: "https://i.imgur.com/eIZC0yH.png",
    },
    {
        titulo: "Michelangelo's Statue of David covered in brickwork to prevent damage from bombing during World War II",
        imagem: "https://i.imgur.com/PgMKq6S.png",
    },
    {
        titulo: "Famous beachfront home in San Francisco, USA, in 1907, shortly before it was destroyed by fire",
        imagem: "https://i.imgur.com/E3rAaKZ.png",
    },
    {
        titulo: "Historic photo of Princess Diana shaking hands with an AIDS patient without gloves in 1991, at a time when prejudice and ignorance still guided notions about the disease's contagion",
        imagem: "https://i.imgur.com/LdsE0TS.png",
    },
    {
        titulo: "“Selfie” taken by Tsar Nicholas II of Russia before the revolution",
        imagem: "https://i.imgur.com/hBEu5tk.png",
    },
    {
        titulo: "Gaspar Wallnöfer, aged 79 in 1917, the oldest Australian soldier during the First World War, who had already fought in battles in Italy in 1848 and 1866",
        imagem: "https://i.imgur.com/nYdyTjF.png",
    },
    {
        titulo: "“Night Witches”, a group of Russian pilots who bombed the Nazis in night attacks, in 1941",
        imagem: "https://i.imgur.com/nK0ydXb.png",
    },
    {
        titulo: "Las Vegas police officers in front of Mike Tyson moments after the fighter bit off part of his opponent Evander Holyfield's ear in 1996",
        imagem: "https://i.imgur.com/Dw075SY.png",
    },
    {
        titulo: "Young Bill Clinton shaking hands with then-President John Kennedy at the White House in 1963",
        imagem: "https://i.imgur.com/MwC2K0h.png",
    },
    {
        titulo: "Workers atop the North Tower of the World Trade Center in New York in 1973",
        imagem: "https://i.imgur.com/kUy0V52.png",
    },
    {
        titulo: "Before and after the Second World War of Soviet soldier Eugen Stepanovich Kobytev: left, in 1941, the day he went to war, and right, 1945, at the end of the conflict",
        imagem: "https://i.imgur.com/RnjY0za.png",
    },
    {
        titulo: "British soldier with his young daughter returning home in 1945",
        imagem: "https://i.imgur.com/EoX9JIB.png",
    },
    {
        titulo: "Cetshwayo, King of the Zulus, who defeated the British army at the Battle of Isandlwana, 1878",
        imagem: "https://i.imgur.com/DedYfRB.png",
    },
    {
        titulo: "Anti-British propaganda in Japan in 1941",
        imagem: "https://i.imgur.com/WFmfZBF.png",
    },
    {
        titulo: "Undercover police officer on the job in New York City, 1969",
        imagem: "https://i.imgur.com/w0sAgsN.png",
    },
    {
        titulo: "Acrobats on top of the Empire State Building in New York in 1934",
        imagem: "https://i.imgur.com/1COKRBn.png",
    },
    {
        titulo: "Road crossing the snow of the Pyrenees Mountains, in the French part, in 1956",
        imagem: "https://i.imgur.com/j6sDEOt.png",
    },
    {
        titulo: "US soldier saving two Vietnamese children during the Vietnam War in 1968",
        imagem: "https://i.imgur.com/KutBakT.png",
    },
    {
        titulo: "Red Cross nurse writing down the last words of a soldier on his deathbed in 1917",
        imagem: "https://i.imgur.com/Y7ziMVO.png",
    },
];


async function histimag(bot, message) {
    const historicoIndex = Math.floor(Math.random() * historicos.length);
    const historico = historicos[historicoIndex];

    if (message.message_id) {
        await bot.sendPhoto(message.chat.id, historico.imagem, {
            caption: `<b>${historico.titulo}</b>`,
            parse_mode: "HTML",
            reply_to_message_id: message.message_id,
        });
    } else {
        await bot.sendPhoto(message.chat.id, historico.imagem, {
            caption: `<b>${historico.titulo}</b>`,
            parse_mode: "HTML",
        });
    }
}

module.exports = {
    histimag: histimag,
};
