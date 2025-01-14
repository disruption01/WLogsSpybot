const {
    Client,
    GatewayIntentBits,
    EmbedBuilder
} = require('discord.js');
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
            }), {
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
            'https://fresh.warcraftlogs.com/api/v2/client', {
                query
            }, {
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

async function isWipe(reportCode, fightId) {
    const query = `
        {
            reportData {
            report(code: "${reportCode}") {
                events(
                    killType: Wipes,
                    fightIDs: [${fightId}]
                ) {
                    data
                    nextPageTimestamp
                }
                }
            }
        }`;

    try {
        const response = await axios.post(
            'https://fresh.warcraftlogs.com/api/v2/client', {
                query
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.data.data.reportData.report.events.data || response.data.data.reportData.report.events.data.length == 0)
            return false;

        return true;
    } catch (error) {
        console.error('Error fetching wipe:', error);
        return true;
    }
}

async function checkData(reportCode, fightId, sourceId = null, abilityId = null, dataType = "Buffs", hostilityType = null, startTime = null, endTime = null) {
    const query = `{
        reportData {
            report(code: "${reportCode}") {
                table(
                    ${fightId ? "fightIDs: [" + fightId + "]," : ""},
                    ${dataType ? "dataType: " + dataType + "," : ""}
                    ${abilityId ? "abilityID: " + abilityId + "," : ""}
                    ${sourceId ? "sourceID: " + sourceId + "," : ""}
                    ${hostilityType ? "hostilityType: " + hostilityType + "," : ""}
                    ${startTime !== undefined && startTime !== null ? "startTime: " + startTime + "," : ""}
                    ${endTime !== undefined && endTime !== null ? "endTime: " + endTime + "," : ""}
                )
            }
        }
    }`;

    // console.log(query);

    try {
        const response = await axios.post(
            'https://fresh.warcraftlogs.com/api/v2/client', {
                query
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        // console.dir(response.data, { depth: null });

        return response.data.data.reportData.report.table.data;
    } catch (error) {
        console.error('Error fetching buffs for fight:', error);
        return false;
    }
}

async function getSummary(reportCode) {
    const query = `{
                    reportData {
                        report(code: "${reportCode}") {
                            table(startTime: 0, endTime: 1000000, dataType: Summary)
                        }
                    }
                }`;

    try {
        const response = await axios.post(
            'https://fresh.warcraftlogs.com/api/v2/client', {
                query
            }, {
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

async function sendMessage(text, discordMessager) {
    if (discordMessager)
        discordMessager.channel.send(text);

    console.log(text);
}

async function buffCheck(reportCode, buffId, buffName, fightId, players) {
    var buffsStr = "";
    const buffData = await checkData(reportCode, fightId, null, buffId, "Buffs");
    const playersWithoutBuff = players.filter(function (player) {
        return buffData.auras.filter((buffedPlayer) => buffedPlayer.id == player.id).length == 0;
    });

    playersWithoutBuff.forEach((player) => {
        var msg = "🔴 **" + player.name + "** did not have " + buffName + ".\n";
        buffsStr += msg;
        console.log(msg);
    });

    return buffsStr;
}

async function dispelCheck(reportCode, fightId, embed) {
    var dispellsStr = "";
    const dispelData = await checkData(reportCode, fightId, null, null, "Dispels");
    dispelData.entries[0].entries.forEach((spell) => {
        // var spellMsg = "🔵 **" + spell.name + "**:\n\n";
        // console.log(spellMsg);
        // dispellsStr += spellMsg;
        spell.details.sort((a, b) => b.total - a.total).forEach((player) => {
            var msg = "• **" + player.name + "** did **" + player.total + "** dispels.\n";
            dispellsStr += msg;
            console.log(msg);
        })

        embed.addFields({
            name: `Dispell check: ${spell.name}`, // Bold and underline the encounter name
            // value: `Status: ${status}\n\n${fightInfo}\n\n\n`,
            value: dispellsStr
        });

        dispellsStr = "";
    });

}

async function castCheck(reportCode, fightId, abilityId, abilityName, embed) {
    var castStr = "";
    const castData = await checkData(reportCode, fightId, null, abilityId, "Casts");
    var count = 0;
    castData.entries.sort((a, b) => b.total - a.total).forEach((player) => {
        var msg = "• **" + player.name + "** casted **" + player.total + "** " + abilityName + "'s.\n";
        castStr += msg;
        console.log(msg);
        count++;
    });

    if (count == 0)
        return;

    embed.addFields({
        name: `Cast Check: ${abilityName}`, // Bold and underline the encounter name
        value: castStr
    });
}

async function activityCheck(reportCode, embed) {
    var msg = "Data: \n";
    const activityDataDps = await checkData(reportCode, null, null, null, "DamageDone", null, 0, 1000000);
    // console.dir(activityDataDps, { depth: null });
    activityDataDps.entries.forEach((player) => {
        if (player.icon != "Shaman-Restoration" && player.icon != "Priest-Holy") {
            var activePercent = ((player.activeTime / activityDataDps.totalTime) * 100).toFixed(2);

            // console.log(player.name, activePercent);

            if (activePercent < 80)
            {
                embed.addFields([
                    {
                        name: player.name,
                        value: "was active for **" + activePercent + "%** witch seems to be low.\n",
                    }
                ]);
            }
        }
    });

    // const activityDataHealer = await checkData(reportCode, null, null, null, "Healing", null, 0, 1000000);
    // // console.dir(activityDataDps, { depth: null });
    // activityDataHealer.entries.forEach((player) => {
    //     if (player.icon == "Shaman-Restoration" || player.icon == "Priest-Holy") {
    //         var activePercent = ((player.activeTime / activityDataHealer.totalTime) * 100).toFixed(2);

    //         console.log(player.name, activePercent);

    //         if (activePercent < 80)
    //             msg += "• **" + player.name + "** was active for **" + activePercent + "%** witch seems to be low.\n";
    //     }
    // });

    return msg;
}

async function debuffUptimeCheck(reportCode, debuffId, debuffName, fightId, sourceID, embed) {
    // Fetch the debuff data
    const debuffData = await checkData(reportCode, fightId, null, debuffId, "Debuffs", "Enemies");

    // Ensure there is at least one aura in the array
    if (!debuffData.auras || debuffData.auras.length === 0) {
        console.log(`No auras found for debuff ID ${debuffId}.`);
        return "";
    }

    // Access the first aura's totalUptime
    // const totalUptime = debuffData.auras[0].totalUptime || 0;
    var totalUptime = 0;

    debuffData.auras.forEach((aura) => {
        totalUptime += aura.totalUptime;
    });

    const totalTime = debuffData.totalTime || 0;

    // Prevent division by zero
    if (totalTime === 0) {
        console.error("Error: totalTime is 0, cannot calculate uptime percentage.");
        return;
    }

    // Calculate uptime percentage
    const uptimePercentage = ((totalUptime / totalTime) * 100).toFixed(2);

    // Send a message if uptime is below 90%
    if (uptimePercentage < 80) {
        var msg = `🟡 ${debuffName} had uptime below 80%. **Total uptime:** ${uptimePercentage}%\n`;
        console.log(msg);
        embed.addFields({
            name: `Debuff check: ${debuffName}`, // Bold and underline the encounter name
            // value: `Status: ${status}\n\n${fightInfo}\n\n\n`,
            value: `🟡 Had uptime below 80%. **Total uptime:** ${uptimePercentage}%`
        });
    }


}

async function processLogCheck(discordMessager, reportCode) {
    await getAccessToken();


    const summary = await getSummary(reportCode);
    const playerDetails = Object.values(summary.data.playerDetails).flat();


    const fights = await getReportFights(reportCode);

    if (!fights) {
        sendMessage("No fights found", discordMessager);
        return;
    }



    // embed.addFields([
    //     {
    //         name: `**Player Activity**`,
    //         value: "Data:\n",
    //     }
    // ]);

    // await activityCheck(reportCode, embed);
    // if (discordMessager)
    //     discordMessager.channel.send({
    //         embeds: [embed]
    //     });
    // return;

    for (const fight of fights.filter((fight) => fight.encounterID > 0)) {


        const wipe = await isWipe(reportCode, fight.id);

        //sendMessage("## " + fight.name + " " + (wipe ? "(Wipe)" : ""), discordMessager);
        const encounterName = fight.name;
        const status = wipe ? "❌ Wipe" : "✅ Kill";

        const embed = new EmbedBuilder()
        .setTitle(`💀 **__${encounterName}__** 💀`)
        .setColor(0xff4500) // Set embed color
        .setFooter({
            text: "Generated by WLogsSpyBot\nAuthor: Silver (Underratedd)"
        });

        embed.addFields({
            name: `Fight Details`, // Bold and underline the encounter name
            // value: `Status: ${status}\n\n${fightInfo}\n\n\n`,
            value: `Status: ${status}`
        });

        // var fightInfo = "";
        await castCheck(reportCode, fight.id, 10060, "Power Infusion", embed);

        await debuffUptimeCheck(reportCode, 12579, "Winter's Chill", fight.id, null, embed);
        await debuffUptimeCheck(reportCode, 11722, "Curse of Elements", fight.id, null, embed);
        await debuffUptimeCheck(reportCode, 11717, "Curse of Recklessness", fight.id, null, embed);
        await debuffUptimeCheck(reportCode, 17937, "Curse of Shadow", fight.id, null, embed);

        await dispelCheck(reportCode, fight.id, embed);
        // await buffCheck(reportCode, 17628, "Flask of Supreme Power", fight.id, playerDetails.filter((player) => player.type == "Warlock" || player.type == "Mage" || player.icon == "Priest-Shadow"), discordMessager);

        // fightInfo += "**FIGHT SPECIFIC CHECKS**\n\n";
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
            {
                console.log("Processing Ragnaros...");
                // fightInfo += await buffCheck(reportCode, 17543, "Greater Fire Protection Potion", fight.id, playerDetails);
                break;
            }
            // Onyxia's Lair Boss
            case 150663: // Onyxia
                console.log("Processing Onyxia...");
                break;

            default:
                console.log(`Encounter ID ${fight.encounterID} not recognized.`);
                break;
        }



        if (discordMessager)
            discordMessager.channel.send({
                embeds: [embed]
            });
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

client.on('messageCreate', async (discordMessager) => {
    if (discordMessager.content.startsWith('!checklog')) {
        const args = discordMessager.content.split(' ');
        if (args.length < 2) {
            discordMessager.reply('Please provide a log ID. Example: !checklog 7yWMKjFQXYncLzxd');
            return;
        }

        const reportCode = args[1];
        discordMessager.reply(`Checking log: ${reportCode}...`);
        await processLogCheck(discordMessager, reportCode);
    }
});

// ✅ Log in the bot
client.login(TOKEN);

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Call processLogCheck automatically when the bot starts
    // const reportCode = "AxknbPpV2DZhWaYw";
    // console.log(`Processing log: ${reportCode}...`);
    // await processLogCheck(null, reportCode);
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