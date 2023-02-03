/*
LIBRARIES
*/

require('dotenv').config();

const { getNoAllowedChannelIdError, getChannelNotAllowedError, getBroadcasterId, validate } = require('./util');
const { createPoll, endPoll, getPoll } = require('./polls');
const { createPrediction, endPrediction, getPrediction } = require('./predictions');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
const fs = require('fs');

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

const mySecret = process.env['DISCORD_TOKEN'];  // Discord Token

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
	if (!process.env['ALLOWED_CHANNEL_ID']) {
		await interaction.reply({
			content: getNoAllowedChannelIdError(interaction.channel),
			ephemeral: process.env['EPHEMERAL'] == 'true'
		});
	} else if (interaction.channel.id != process.env['ALLOWED_CHANNEL_ID']) {
		await interaction.reply({
			content: getChannelNotAllowedError(interaction.channel),
			ephemeral: process.env['EPHEMERAL'] == 'true'
		});
	} else {
		await interaction.deferReply();
		await validate(false).then(async (value) => {
			switch (interaction.commandName) {
				case 'poll':
					await createPoll(interaction);
					break;
				case 'endpoll':
					await endPoll(interaction);
					break;
				case 'getpoll':
					await getPoll(interaction);
					break;
				case 'prediction':
					await createPrediction(interaction);
					break;
				case 'endprediction':
					await endPrediction(interaction);
					break;
				case 'getprediction':
					await getPrediction(interaction);
					break;
			}
		}).catch(async (err) => {
			await interaction.editReply({
				content: 'Token validation failed!'
			});
		});
	}
}

/*
BOT START CODE (login, start server, etc)

This section checks if there is a TOKEN secret and uses it to login if it is found. If not, the bot outputs a log to the console and terminates.
*/

const server = express();
server.all('/', async (req, res) => {
	const authObj = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&code=${req.query.code}&grant_type=authorization_code&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}`, {
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
		console.log(`Open the following Website to authenticate: https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}&response_type=code&scope=channel%3Aread%3Apolls%20channel%3Aread%3Apredictions%20channel%3Amanage%3Apolls%20channel%3Amanage%3Apredictions`);
		require('open')(`https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}&response_type=code&scope=channel%3Aread%3Apolls%20channel%3Aread%3Apredictions%20channel%3Amanage%3Apolls%20channel%3Amanage%3Apredictions`);
	}
});
if (!mySecret) {
	console.log("TOKEN not found! You must setup the Discord TOKEN as per the README file before running this bot.");
	process.kill(process.pid, 'SIGTERM');  // Kill Bot
} else {
	if (fs.existsSync('./.tokens.json')) {
		tokens = require('./.tokens.json');
		validate().then(() => {
			// Logs in with secret TOKEN
			client.login(mySecret);
		}).catch(() => {
			console.log('Failed to validate token, refresh token or authenticate!');
			process.kill(process.pid, 'SIGTERM');
		});
	}
}
