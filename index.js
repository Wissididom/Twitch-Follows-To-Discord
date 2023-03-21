import * as dotenv from 'dotenv';

import {
	Client,
	GatewayIntentBits,
	Partials
} from 'discord.js';
import express from 'express';
import * as fs from 'node:fs';
import open, {openApp, apps} from 'open';

import {
	getNoAllowedChannelIdError,
	getChannelNotAllowedError
} from './util.js';

import {
	getBroadcasterId,
	getPoll,
	getPollId,
	createPoll,
	endPoll,
	getPrediction,
	getPredictionId,
	createPrediction,
	endPrediction,
	getScopes,
	getAuthorizationEndpoint,
	getAccessTokenByAuthTokenEndpoint,
	validateTwitchToken
} from './twitchApi.js';

dotenv.config();

/*
OBJECTS, TOKENS, GLOBAL VARIABLES
*/

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.DirectMessages
	],
	partials: [
		Partials.User,
		Partials.Channel,
		Partials.GuildMember,
		Partials.Message,
		Partials.Reaction
	]
});

const mySecret = process.env.DISCORD_TOKEN;

let tokens = {
	access_token: 'N/A',
	refresh_token: 'N/A'
};

/*
BOT ON

This section runs when the bot is logged in and listening for commands. First, it writes a log to the console indicating it is logged in. Next, it listens on the server and determines whether a message starts with ! or $ before calling either the Admin checkCommand function, or the User checkInput function.
*/

// Outputs console log when bot is logged in
client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);  // Logging
});

client.on("interactionCreate", async interaction => {
	if (interaction.isCommand() || interaction.isChatInputCommand())
		await handleCommand(interaction);
});

async function handleCommand(interaction) {
	if (!process.env.ALLOWED_CHANNEL_ID) {
		await interaction.reply({
			content: getNoAllowedChannelIdError(interaction.channel),
			ephemeral: process.env.EPHEMERAL == 'true'
		});
		return;
	}
	if (interaction.channel.id != process.env.ALLOWED_CHANNEL_ID) {
		await interaction.reply({
			content: getChannelNotAllowedError(interaction.channel),
			ephemeral: process.env.EPHEMERAL == 'true'
		});
		return;
	}
	await interaction.deferReply();
	await validateTwitchToken(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, tokens, 'http://localhost', process.env.LOCAL_SERVER_PORT, false).then(async (/*value*/) => {
		switch (interaction.commandName) {
			case 'getpoll':
				await getPollCommand(interaction);
				break;
			case 'poll':
				await createPollCommand(interaction);
				break;
			case 'endpoll':
				await endPollCommand(interaction);
				break;
			case 'getprediction':
				await getPredictionCommand(interaction);
				break;
			case 'prediction':
				await createPredictionCommand(interaction);
				break;
			case 'endprediction':
				await endPredictionCommand(interaction);
				break;
		}
	}).catch(async (err) => {
		await interaction.editReply({
			content: `Token validation failed! (${err})`
		});
		console.trace(err);
	});
}

async function getPollCommand(interaction) {
	const broadcasterId = await getBroadcasterId(process.env.TWITCH_CLIENT_ID, tokens.access_token);
	await getPoll(process.env.TWITCH_CLIENT_ID, tokens.access_token, broadcasterId).then(async res => {
		await interaction.editReply({
			content: res
		});
	}).catch(async err => {
		await interaction.editReply({
			content: `Error getting Poll from Twitch: ${err}`
		});
	});
}

async function createPollCommand(interaction) {
	const broadcasterId = await getBroadcasterId(process.env.TWITCH_CLIENT_ID, tokens.access_token);
	const title = interaction.options.getString('title');
	const choicesStr = interaction.options.getString('choices').split(';');
	let choicesArr = [];
	for (let i = 0; i < choicesStr.length; i++) {
		choicesArr.push({
			title: choicesStr[i].trim()
		});
	}
	const duration = interaction.options.getInteger('duration');
	const unit = interaction.options.getString('unit');
	let durationMultiplier = 1;
	if (unit && unit.toLowerCase() == 'minutes')
		durationMultiplier = 60;
	const cpve = interaction.options.getBoolean('channelpoints'); // Channel Points Voting Enabled
	const cppv = interaction.options.getBoolean('cpnumber'); // Channel Points Per Vote
	await createPoll(process.env.TWITCH_CLIENT_ID, tokens.access_token, broadcasterId, title, choicesArr, duration * durationMultiplier, cpve, cppv).then(async res => {
		await interaction.editReply({
			content: res
		});
	}).catch(async err => {
		await interaction.editReply({
			content: `Error getting Poll from Twitch: ${err}`
		});
	});
}

async function endPollCommand(interaction) {
	const broadcasterId = await getBroadcasterId(process.env.TWITCH_CLIENT_ID, tokens.access_token);
	let status = interaction.options.getString('status');
	if (status.includes(' ')) // There shouldn't be a space in the value but better safe than sorry
		status = status.substring(0, status.indexOf(' ')).trim();
	await getPollId(process.env.TWITCH_CLIENT_ID, tokens.access_token, broadcasterId).then(async res => {
		await endPoll(process.env.TWITCH_CLIENT_ID, tokens.access_token, broadcasterId, res, status).then(async res => {
			await interaction.editReply({
				content: res
			});
		}).catch(async err => {
			await interaction.editReply({
				content: `Error ending Poll on Twitch: ${err}`
			});
		});
	}).catch(async err => {
		await interaction.editReply({
			content: `Error getting Poll-ID to be ended from Twitch: ${err}`
		});
	});
}

async function getPredictionCommand(interaction) {
	const broadcasterId = await getBroadcasterId(process.env.TWITCH_CLIENT_ID, tokens.access_token);
	await getPrediction(process.env.TWITCH_CLIENT_ID, tokens.access_token, broadcasterId).then(async res => {
		await interaction.editReply({
			content: res
		});
	}).catch(async err => {
		await interaction.editReply({
			content: `Error getting prediction from Twitch: ${err}`
		});
	});
}

async function createPredictionCommand(interaction) {
	const broadcasterId = await getBroadcasterId(process.env.TWITCH_CLIENT_ID, tokens.access_token);
	const title = interaction.options.getString('title');
	const outcomesStr = interaction.options.getString('outcomes').split(';');
	let outcomesArr = [];
	for (let i = 0; i < outcomesStr.length; i++) {
		outcomesArr.push({
			title: outcomesStr[i].trim()
		});
	}
	const duration = interaction.options.getInteger('duration');
	const unit = interaction.options.getString('unit');
	let durationMulitplier = 1;
	if (unit.toLowerCase() == 'minutes')
		durationMultiplier = 60;
	await createPrediction(process.env.TWITCH_CLIENT_ID, tokens.access_token, broadcasterId, title, outcomesArr, duration * durationMultiplier).then(async res => {
		await interaction.editReply({
			content: res
		});
	}).catch(async err => {
		await interaction.editReply({
			content: `Error creating prediction on Twitch: ${err}`
		});
	});
}

async function endPredictionCommand(interaction) {
	const broadcasterId = await getBroadcasterId(process.env.TWITCH_CLIENT_ID, tokens.access_token);
	let status = interaction.options.getString('status');
	if (status.includes(' ')) // There shouldn't be a space in the value but better safe than sorry
		status = status.substring(0, status.indexOf(' ')).trim();
	const winningOutcomeId = interaction.options.getString('winning_outcome_id') ?? undefined;
	await getPredictionId(process.env.TWITCH_CLIENT_ID, tokens.access_token, broadcasterId).then(async res => {
		await endPrediction(process.env.TWITCH_CLIENT_ID, tokens.access_token, broadcasterId, res, status, winningOutcomeId).then(async res => {
			await interaction.editReply({
				content: res
			});
		}).catch(async err => {
			await interaction.editReply({
				content: `Error ending Prediction on Twitch: ${err}`
			});
		});
	}).catch(async err => {
		await interaction.editReply({
			content: `Error getting Prediction-ID to be ended from Twitch: ${err}`
		});
	});
}

const server = express();
server.all('/', async (req, res) => {
	const authObj = await fetch(getAccessTokenByAuthTokenEndpoint(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, req.query.code, 'http://localhost', process.env.LOCAL_SERVER_PORT), {
		method: 'POST'
	}).then(res => res.json()).catch(err => console.error);
	if (authObj.access_token) {
		tokens = authObj;
		fs.writeFileSync('./.tokens.json', JSON.stringify(authObj));
		res.send('<html>Tokens saved!</html>');
		console.log('Tokens saved!');
	} else
		res.send("Couldn't get the access token!");
		console.log("Couldn't get the access token!");
});
server.listen(parseInt(process.env.LOCAL_SERVER_PORT), () => {
	console.log('Express Server ready!');
	if (!fs.existsSync('./.tokens.json')) {
		console.log(`Open the following Website to authenticate: ${getAuthorizationEndpoint(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, 'http://localhost', process.env.LOCAL_SERVER_PORT, getScopes())}`);
		open(getAuthorizationEndpoint(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, 'http://localhost', process.env.LOCAL_SERVER_PORT, getScopes()));
	}
});
if (!mySecret) {
	console.log("TOKEN not found! You must setup the Discord TOKEN as per the README file before running this bot.");
	process.kill(process.pid, 'SIGTERM');  // Kill Bot
} else {
	if (fs.existsSync('./.tokens.json')) {
		tokens = JSON.parse(fs.readFileSync('./.tokens.json', {encoding: 'utf8', flag: 'r'}));
		validateTwitchToken(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, tokens, 'http://localhost', process.env.LOCAL_SERVER_PORT).then(() => {
			// Logs in with secret TOKEN
			client.login(mySecret);
		}).catch(() => {
			console.log('Failed to validate token, refresh token or authenticate!');
			process.kill(process.pid, 'SIGTERM');
		});
	}
}
