require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenAI } = require('@google/genai');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');

// Settings
const botName = process.env.BOT_NAME || 'HubGemini AI';
const botPrefix = '.';    // සාමාන්‍ය Commands වැඩ කරන ලකුණ (.)
const aiPrefix = ',';     // ජෙමිනි AI වැඩ කරන ලකුණ (,)

// Gemini AI Setup
let ai = null;
if (process.env.GEMINI_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });
}

const chatMemory = {}; 

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// QR Code එක Heroku Logs වල පෙන්වීම
client.on('qr', (qr) => {
    console.log('==================================================');
    console.log('👇 කරුණාකර පහත QR CODE එක ඔයාගේ ෆෝන් එකෙන් ස්කෑන් කරන්න 👇');
    console.log('==================================================');
    qrcode.generate(qr, { small: false });
});

client.on('ready', () => {
    console.log(`🎯 ${botName} සහ සියලුම මොඩියුල සාර්ථකව ක්‍රියාත්මකයි!`);
});

// මැසේජ් ලැබෙද්දී වැඩ කරන ප්‍රධාන කොටස
client.on('message', async (msg) => {
    const text = msg.body.trim();
    const chat = await msg.getChat();

    // ----------------------------------------------------
    // 🤖 ක්‍රමය A: බොට්ගේ සාමාන්‍ය Commands (තිතෙන් පටන් ගන්නා ඒවා - .)
    // ----------------------------------------------------
    if (text.startsWith(botPrefix)) {
        const args = text.slice(botPrefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const input = args.join(' ');

        // 1. .help / .menu Command (සම්පූර්ණ මෙනු එක සිංහලෙන්ම)
        if (command === 'help' || command === 'menu') {
            let helpMenu = `🤖 *${botName} - සිංහල මෙනු පද්ධතිය* 🤖\n\n`;
            helpMenu += `💡 *Prefixes (භාවිතා කරන ලකුණු):*\n`;
            helpMenu += `• සාමාන්‍ය Commands සඳහා: [ *.* ]\n`;
            helpMenu += `• Gemini AI සමඟ Chat කිරීමට: [ *,* ]\n\n`;
            
            helpMenu += `👥 *ගෲප් මොඩියුල (Group Modules):*\n`;
            helpMenu += `• \`.alive\` - බොට් ඔන්ලයින්දැයි බැලීමට ⚡\n`;
            helpMenu += `• \`.ping\` - බොට්ගේ වේගය (Latency) බැලීමට 🏓\n`;
            helpMenu += `• \`.tagall\` - ගෲප් එකේ සැමෝම ටැග් කිරීමට 🏷️\n`;
            helpMenu += `• \`.antilink\` - ලින්ක් මැකීමේ ආරක්ෂාව 🛡️\n`;
            helpMenu += `• \`.kick\` - සාමාජිකයින් ඉවත් කිරීමට 👢\n\n`;
            
            helpMenu += `📩 *පෞද්ගලික මොඩියුල (Private Modules):*\n`;
            helpMenu += `• \`.song [ලින්ක් එක]\_ - YouTube සින්දු (MP3) 📥\n`;
            helpMenu += `• \`.video [ලින්ක් එක]\_ - YouTube වීඩියෝ (MP4) 🎬\n`;
            helpMenu += `• \`.sticker\` - පින්තූර ස්ටිකර් කිරීමට (Reply කරන්න) 🎨\n`;
            helpMenu += `• \`.tts [වචන ටික]\_ - ශබ්ද නගා කියවීමට 🗣️\n\n`;
            
            helpMenu += `🧠 *Gemini AI Assistant:*\n`;
            helpMenu += `• ඕනෑම ප්‍රශ්නයක් ඉස්සරහට කොමාවක් (,) දමා PM එකේ ටයිප් කරන්න. (උදා: \`,කවි ලිවීමේ වැදගත්කම\`)\n\n`;
            helpMenu += `🧑‍💻 *Creator:* Lakmina`;
            
            await msg.reply(helpMenu);
            return;
        }

        // 2. Alive Command
        if (command === 'alive') {
            await msg.reply(`👋 හලෝ අයියේ! මම ${botName}.\n\n🤖 Gemini AI සහ සියලුම Commands දැන් සක්‍රීයයි!\n\nසම්පූර්ණ විස්තරය සඳහා \`.help\` ලෙස ටයිප් කරන්න.`);
            return;
        }

        // 3. Ping Command
        if (command === 'ping') {
            const start = Date.now();
            const reply = await msg.reply('වේගය පරීක්ෂා කරමින් පවතී... 🏓');
            const end = Date.now();
            await reply.edit(`Pong! 🏓\nප්‍රතිචාර කාලය: *${end - start}ms*`);
            return;
        }

        // 4. YouTube Song Downloader (.song)
        if (command === 'song') {
            if (!input || !ytdl.validateURL(input)) {
                await msg.reply("❌ අනේ අයියේ, කරුණාකර නිවැරදි YouTube ලින්ක් එකක් ඇතුළත් කරන්න!\n\nභාවිතය: `.song https://youtu.be/...` Concepts");
                return;
            }
            try {
                await msg.reply("📥 ඔයා ඉල්ලපු සින්දුව ඩවුන්ලෝඩ් වෙමින් පවතිනවා... කරුණාකර පොඩ්ඩක් ඉන්න අයියේ! 🎵");
                const info = await ytdl.getInfo(input);
                const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
                const filePath = `./${title}.mp3`;

                ytdl(input, { filter: 'audioonly', quality: 'highestaudio' })
                    .pipe(fs.createWriteStream(filePath))
                    .on('finish', async () => {
                        const media = MessageMedia.fromFilePath(filePath);
                        await client.sendMessage(msg.from, media, { sendAudioAsVoice: false });
                        fs.unlinkSync(filePath);
                    })
                    .on('error', async () => {
                        await msg.reply("❌ සින්දුව ඩවුන්ලෝඩ් කිරීමේදී ගැටලුවක් මතු වුණා අයියේ.");
                    });
            } catch (e) {
                await msg.reply("❌ පද්ධතියේ දෝෂයක්. පසුව උත්සාහ කරන්න.");
            }
            return;
        }

        // 5. YouTube Video Downloader (.video)
        if (command === 'video') {
            if (!input || !ytdl.validateURL(input)) {
                await msg.reply("❌ අනේ අයියේ, කරුණාකර නිවැරදි YouTube ලින්ක් එකක් ඇතුළත් කරන්න!\n\nභාවිතය: `.video https://youtu.be/...`🎤");
                return;
            }
            try {
                await msg.reply("📥 ඔයාගේ වීඩියෝව ඩවුන්ලෝඩ් වෙමින් පවතිනවා... කරුණාකර පොඩ්ඩක් ඉන්න අයියේ! 🎬");
                const info = await ytdl.getInfo(input);
                const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
                const filePath = `./${title}.mp4`;

                ytdl(input, { quality: '18' }) // 360p MP4
                    .pipe(fs.createWriteStream(filePath))
                    .on('finish', async () => {
                        const media = MessageMedia.fromFilePath(filePath);
                        await client.sendMessage(msg.from, media, { caption: `🎬 *වීඩියෝව:* ${info.videoDetails.title}\n🧑‍💻 *සැකසුම:* Lakmina` });
                        fs.unlinkSync(filePath);
                    })
                    .on('error', async () => {
                        await msg.reply("❌ වීඩියෝව ඩවුන්ලෝඩ් කරන්න බැරි වුණා අයියේ.");
                    });
            } catch (e) {
                await msg.reply("❌ පද්ධතියේ දෝෂයක් මතු වුණා.");
            }
            return;
        }

        // 6. Sticker Maker (.sticker)
        if (command === 'sticker') {
            if (msg.hasQuotedMsg) {
                const quotedMsg = await msg.getQuotedMessage();
                if (quotedMsg.hasMedia) {
                    try {
                        await msg.reply("🎨 පින්තූරය ස්ටිකරයක් බවට පත් කරමින් පවතී... පොඩ්ඩක් ඉන්න!");
                        const media = await quotedMsg.downloadMedia();
                        await client.sendMessage(msg.from, media, { sendMediaAsSticker: true });
                    } catch (err) {
                        await msg.reply("❌ ස්ටිකරය සෑදීමට අපොහොසත් වුණා අයියේ.");
                    }
                } else {
                    await msg.reply("❌ කරුණාකර පින්තූරයකට හෝ වීඩියෝවකට රිප්ලයි (Reply) කර `.sticker` ලෙස ටයිප් කරන්න.");
                }
            } else {
                await msg.reply("❌ කරුණාකර පින්තූරයකට රිප්ලයි කර `.sticker` ලෙස ටයිප් කරන්න අයියේ.");
            }
            return;
        }

        // 7. Group Tag All (.tagall)
        if (command === 'tagall') {
            if (!chat.isGroup) {
                await msg.reply("❌ මෙම කමාන්ඩ් එක භාවිතා කළ හැක්කේ ගෲප් ඇතුළත පමණි අයියේ!");
                return;
            }
            let mentions = [];
            let responseText = `📢 *සියලුම දෙනා අවධානය යොමු කරන්න!* 📢\n\n✍️ *පණිවිඩය:* ${input || 'විශේෂ පණිවිඩයක් නොමැත.'}\n\n`;
            for (let participant of chat.participants) {
                const contact = await client.getContactById(participant.id._serialized);
                mentions.push(contact);
                responseText += `@${participant.id.user} `;
            }
            await chat.sendMessage(responseText, { mentions });
            return;
        }
    }

    // ----------------------------------------------------
    // 🧠 ක්‍රමය B: Gemini AI Chat (කොමාවෙන් පටන් ගන්නා ඒවා - ,) - Private Message විතරයි
    // ----------------------------------------------------
    if (text.startsWith(aiPrefix) && !chat.isGroup) {
        if (!ai) {
            await msg.reply("❌ Gemini API Key එක සෙටප් කරලා නැහැ අයියේ. කරුණාකර Heroku එකේ GEMINI_KEY එක ඇතුළත් කරන්න.");
            return;
        }

        const prompt = text.slice(aiPrefix.length).trim();
        if (!prompt) {
            await msg.reply("අනේ අයියේ, කොමාව දාලා ප්‍රශ්නයක් ලියන්න... (උදා: ,ලෝකයේ දිගම ගඟ කුමක්ද?)");
            return;
        }

        const from = msg.from;
        if (!chatMemory[from]) chatMemory[from] = [];

        try {
            await chat.sendStateTyping(); // ටයිප් කරන බව පෙන්වීම
            
            // AI එකේ පෞරුෂත්වය සිංහලෙන් සහ ඉංග්‍රීසියෙන් හැසිරවීමට උපදෙස්
            const systemInstruction = "You are 'HubGemini AI', a personal chatbot created by Lakmina. Respond in Sinhala language if the user asks in Sinhala. Keep answers friendly, smart, and clear. Avoid other regional languages like Tamil unless requested.";
            const contents = [...chatMemory[from], { role: 'user', parts: [{ text: prompt }] }];

            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: contents,
                config: { systemInstruction: systemInstruction }
            });

            const aiReply = response.text;
            await msg.reply(aiReply);

            // Memory එක සුරැකීම (උපරිම 15ක්)
            chatMemory[from].push({ role: 'user', parts: [{ text: prompt }] });
            chatMemory[from].push({ role: 'model', parts: [{ text: aiReply }] });
            if (chatMemory[from].length > 30) chatMemory[from].splice(0, 2);

        } catch (error) {
            await msg.reply("❌ කනගාටුයි අයියේ, ජෙමිනි AI එකෙන් පිළිතුරක් ලබා ගැනීමට නොහැකි වුණා. පසුව උත්සාහ කරන්න.");
        } finally {
            await chat.clearState();
        }
    }
});

client.initiate();