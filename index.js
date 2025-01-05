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

async function getAccessToken() {
    try {
        const response = await axios.post(
            'https://fresh.warcraftlogs.com/oauth/token',
            new URLSearchParams({
                grant_type: 'client_credentials',
            }),
            {
                auth: {
                    username: process.env.WARCRAFTLOGS_CLIENT_ID,
                    password: process.env.WARCRAFTLOGS_CLIENT_SECRET,
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        accessToken = response.data.access_token;
        console.log('Access token obtained. it is ' + response.data.access_token);
    } catch (error) {
        console.error('Error fetching access token:', error);
    }
}

async function getReportFights(reportCode) {
    console.log(reportCode);
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
            'https://fresh.warcraftlogs.com/api/v2/client',
            { query },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        // // ✅ Log the entire response object
        // console.dir(response.data, { depth: null });

        // // ✅ Pretty-print the JSON response
        // console.log(JSON.stringify(response.data, null, 2));

        return response.data.data.reportData.report.fights;
    } catch (error) {
        console.error('Error fetching report fights:', error);
        return [];
    }
}

async function getBuffsForFight(reportCode, fightId, startTime, endTime) {
    const query = `
    {
        reportData {
            report(code: "${reportCode}") {
                events(startTime: ${startTime}, endTime: ${endTime}, fightIDs: [${fightId}], dataType: Buffs) {
                    data
                    nextPageTimestamp
                }
            }
        }
    }`;

    try {
        const response = await axios.post(
            'https://fresh.warcraftlogs.com/api/v2/client',
            { query },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        console.log(JSON.stringify(response.data, null, 2));
        // Parse the JSON response
        const events = response.data.data.reportData.report.events;
        console.log("Buff Events:", events);

        // Return the parsed events
        return events;
    } catch (error) {
        console.error('Error fetching buffs for fight:', error);
        return [];
    }
}

async function checkPlayerBuff(reportCode, fightId, playerId, buffId) {
    const query = `
    {
        reportData {
            report(code: "${reportCode}") {
                table(fightIDs: [${fightId}], dataType: Buffs, abilityID: ${buffId}, sourceID: ${playerId})
            }
        }
    }`;

    try {
        const response = await axios.post(
            'https://fresh.warcraftlogs.com/api/v2/client',
            { query },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        // console.log(JSON.stringify(response.data, null, 2));
        // Parse the JSON response
        const buffData = response.data.data.reportData.report.table.data;

        if(!buffData.auras || buffData.auras.length == 0)
            return false;

        return true;
    } catch (error) {
        console.error('Error fetching buffs for fight:', error);
        return false;
    }
}

async function getSummary(reportCode)
{
    const query = `{
                    reportData {
                        report(code: "${reportCode}") {
                            table(startTime: 0, endTime: 1000000, dataType: Summary)
                        }
                    }
                }`;

    try {
        const response = await axios.post(
            'https://fresh.warcraftlogs.com/api/v2/client',
            { query },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        // Parse the JSON response from the table field
        const tableData = response.data.data.reportData.report.table;

        // Return the parsed player details
        return tableData;
    } catch (error) {
        console.error('Error fetching report fights:', error);
        return [];
    }
}

async function processLogCheck(message, reportCode) {
    await getAccessToken();

    if(message)
    {
        message.channel.send("# Analyzing Report " + reportCode);
    }

    const summary = await getSummary(reportCode);
    const playerDetails = Object.values(summary.data.playerDetails).flat();
    // console.log(playerDetails);

    // return;

    const fights = await getReportFights(reportCode);

    if (!fights) {
        console.log("No fights found");
        if (message)
            message.channel.send("No fights found");

        return;
    }

    for (const fight of fights.filter((fight) => fight.encounterID > 0)) {
        if(message)
        {
            message.channel.send("## " + fight.name);
        }

        switch (fight.encounterID) {
            // Molten Core Bosses
            case 150664: // Lucifron
            {
                console.log("Processing Lucifron...");
                break;
            }
            case 150665: // Magmadar
                console.log("Processing Magmadar...");
                break;
            case 150666: // Gehennas
                console.log("Processing Gehennas...");
                break;
            case 150667: // Garr
                console.log("Processing Garr...");
                break;
            case 150668: // Shazzrah
                console.log("Processing Shazzrah...");
                break;
            case 150669: // Baron Geddon
                console.log("Processing Baron Geddon...");
                break;
            case 150670: // Sulfuron Harbinger
                console.log("Processing Sulfuron Harbinger...");
                break;
            case 150671: // Golemagg the Incinerator
                console.log("Processing Golemagg the Incinerator...");
                break;
            case 150672: // Ragnaros
                console.log("Processing Ragnaros...");
                // const buffs = await getBuffsForFight(reportCode, fight.id, fight.startTime, fight.endTime);
                // console.log(`Buffs for Ragnaros: ${JSON.stringify(buffs)}`);
                for(const player of playerDetails)
                {
                    const greaterFireCheck = await checkPlayerBuff(reportCode, fight.id, player.id, 17543);
                    if(!greaterFireCheck)
                    {
                        var msg = "**" +player.name + "** didn't had Greater Fire Protection Potion buff."
                        console.log(msg);
                        
                        if(message)
                            message.channel.send(msg);
                    }
                }

                break;

            // Onyxia's Lair Boss
            case 150663: // Onyxia
                console.log("Processing Onyxia...");
                break;

            default:
                console.log(`Encounter ID ${fight.encounterID} not recognized.`);
                break;
        }
    }



    // console.log("ACTUAL FIGHTS");
    // console.log(fights);
    // const ragnarosFight = fights.find(fight => fight.name === 'Ragnaros');

    // if (!ragnarosFight) {
    //     message.reply('Ragnaros fight not found in the report.');
    //     return;
    // }

    // const buffs = await getBuffsForFight(reportCode, ragnarosFight.id);
    // const fireResistancePotionID = 17544; // Fire Resistance Potion spell ID

    // const playersWithoutBuff = new Set();
    // for (const event of buffs) {
    //     if (event.abilityGameID !== fireResistancePotionID) {
    //         playersWithoutBuff.add(event.targetID);
    //     }
    // }

    // if (playersWithoutBuff.size === 0) {
    //     message.reply('Everyone used Fire Resistance Potion during the Ragnaros fight!');
    // } else {
    //     message.reply(`Players who did NOT use Fire Resistance Potion: ${[...playersWithoutBuff].join(', ')}`);
    // }
}

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

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Call processLogCheck automatically when the bot starts
    const reportCode = "7yWMKjFQXYncLzxd";
    //console.log(`Processing log: ${reportCode}...`);
    //await processLogCheck(null, reportCode);
});


// if (require.main === module) {
//     const readline = require('readline').createInterface({
//         input: process.stdin,
//         output: process.stdout
//     });

//     readline.question('Enter the Warcraft Logs report code: ', async (reportCode) => {
//         console.log(`Processing report: ${reportCode}...`);
//         await processLogCheck(reportCode);
//         readline.close();
//     });
// }