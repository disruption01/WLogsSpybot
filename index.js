const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
});

const TOKEN = process.env.BOT_TOKEN;
let accessToken = '';

// 1️⃣ Get Access Token from Warcraft Logs API
async function getAccessToken() {
    try {
        const response = await axios.post('https://www.warcraftlogs.com/oauth/token', null, {
            params: {
                grant_type: 'client_credentials',
            },
            auth: {
                username: process.env.WARCRAFTLOGS_CLIENT_ID,
                password: process.env.WARCRAFTLOGS_CLIENT_SECRET,
            },
        });
        accessToken = response.data.access_token;
        console.log('Access token obtained.');
    } catch (error) {
        console.error('Error fetching access token:', error);
    }
}

// 2️⃣ Fetch Fight Data from a Report
async function getReportFights(reportCode) {
    const query = `
    {
        reportData {
            report(code: "${reportCode}") {
                title
                fights {
                    id
                    name
                    startTime
                    endTime
                    encounterID
                }
            }
        }
    }`;

    try {
        const response = await axios.post(
            'https://www.warcraftlogs.com/api/v2/client',
            { query },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        return response.data.data.reportData.report.fights;
    } catch (error) {
        console.error('Error fetching report fights:', error);
        return [];
    }
}

// 3️⃣ Check Buffs for a Specific Fight (e.g., Ragnaros)
async function getBuffsForFight(reportCode, fightId) {
    const query = `
    {
        reportData {
            report(code: "${reportCode}") {
                events(startTime: 0, endTime: 1000000, fightIDs: [${fightId}], dataType: Buffs) {
                    data {
                        timestamp
                        abilityGameID
                        sourceID
                        targetID
                    }
                }
            }
        }
    }`;

    try {
        const response = await axios.post(
            'https://www.warcraftlogs.com/api/v2/client',
            { query },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        return response.data.data.reportData.report.events.data;
    } catch (error) {
        console.error('Error fetching buffs for fight:', error);
        return [];
    }
}

// 4️⃣ Process the Log Check Command
async function processLogCheck(message, reportCode) {
    await getAccessToken();

    const fights = await getReportFights(reportCode);
    const ragnarosFight = fights.find(fight => fight.name === 'Ragnaros');

    if (!ragnarosFight) {
        message.reply('Ragnaros fight not found in the report.');
        return;
    }

    const buffs = await getBuffsForFight(reportCode, ragnarosFight.id);
    const fireResistancePotionID = 17544; // Fire Resistance Potion spell ID

    const playersWithoutBuff = new Set();
    for (const event of buffs) {
        if (event.abilityGameID !== fireResistancePotionID) {
            playersWithoutBuff.add(event.targetID);
        }
    }

    if (playersWithoutBuff.size === 0) {
        message.reply('Everyone used Fire Resistance Potion during the Ragnaros fight!');
    } else {
        message.reply(`Players who did NOT use Fire Resistance Potion: ${[...playersWithoutBuff].join(', ')}`);
    }
}

// 5️⃣ Handle the '!checklog' Command
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!checklog')) {
        const args = message.content.split(' ');
        if (args.length < 2) {
            message.reply('Please provide a log ID. Example: !checklog 7yWMKjFQXYncLzxd');
            return;
        }

        const reportCode = args[1];
        message.reply(`Checking log: ${reportCode}...`);
        await processLogCheck(message, reportCode);
    }
});

// ✅ Log in the bot
client.login(TOKEN);
