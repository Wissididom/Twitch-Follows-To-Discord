/*
LIBRARIES
*/

require('dotenv').config();

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

client.on("interactionCreate", interaction => {
	if (interaction.isCommand() || interaction.isChatInputCommand())
		handleCommand(interaction);
});

function getNoAllowedChannelIdError(channel) {
	return `Please first set a channel where you want to accept the commands! For <#${channel.id}> (${channel.name}) just set the value for \`ALLOWED_CHANNEL_ID\` to \`${channel.id}\` in the .env file!`;
}

function getChannelNotAllowedError(channel) {
	return `<#${channel.id}> (${channel.name}) is not allowed to accept commands!`;
}

async function getBroadcaster() {
	return (await fetch(`https://api.twitch.tv/helix/users?login=${process.env.BROADCASTER_LOGIN}`, {
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`
		}
	}).then(res => res.json()).catch(err => console.error)).data[0];
}

async function getBroadcasterId() {
	return (await getBroadcaster()).id;
}

function buildPollChoices(create) {
	let response = [];
	let choices = '';
	for (let i = 0; i < data.choices.length; i++) {
		let choice = data.choices[i];
		response.push(`> ${choice.title}`);
		response.push(`> > Choice-ID: ${choice.id}`);
		if (!create) {
			response.push(`> > Votes: ${choice.votes}`);
			response.push(`> > Channel Points Votes: ${choice.channel_points_votes}`);
			response.push(`> > Bits Votes: ${choice.bits_votes}\n`);
		}
	}
	choices = choices.trim();
	return response.join("\n");
}

function toDiscordTimestamp(twitchTime) {
	return `<t:${Math.floor(Date.parse(twitchTime) / 1000)}>`;
}

function handleCommand(interaction) {
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
		}).catch((err) => {
			await interaction.editReply({
				content: 'Token validation failed!'
			});
		});
	}
}

// https://dev.twitch.tv/docs/api/reference#create-poll
async function createPoll(interaction) {
	const broadcasterId = await getBroadcasterId();
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
	const channelPointsVotingEnabled = interaction.options.getBoolean('channelpoints');
	const channelPointsPerVote = interaction.options.getBoolean('cpnumber');
	await fetch('https://api.twitch.tv/helix/polls', {
		method: 'POST',
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			broadcaster_id: broadcasterId,
			title: title,
			choices: choicesArr,
			duration: duration * durationMultiplier,
			channel_points_voting_enabled: channelPointsVotingEnabled,
			channel_points_per_vote: channelPointsPerVote
		})
	}).then(res => res.json()).then(res => {
		let response = [];
		if (res.error) {
			response.push(`Error: ${res.error}`);
			response.push(`Error-Message: ${res.message}`);
		} else {
			const data = res.data[0];
			const channelPointsVoting = data.channel_points_voting_enabled ? 'enabled' : 'disabled';
			response.push(`Poll \`\`${data.title}\`\` successfully started!\n`);
			const choices = buildPollChoices(true);
			response.push(`Title: ${data.title}`);
			response.push(`Poll-ID: ${data.id}`);
			response.push(`Broadcaster: ${data.broadcaster_name}`);
			response.push(`Choices:\n${choices}`);
			response.push(`Channel Points Voting ${channelPointsVoting}`);
			response.push(`Poll Status: ${data.status}`);
			response.push(`Poll Duration: ${data.duration} seconds`);
			response.push(`Started At: ${toDiscordTimestamp(data.started_at)}`);
		}
		await interaction.editReply({
			content: response.join("\n")
		});
	}).catch(async (err) => {
		await interaction.editReply({
			content: `Error creating Poll on Twitch: ${err}`
		});
		await validate(false);
	});
}

// https://dev.twitch.tv/docs/api/reference#end-poll
async function endPoll(interaction) {
	const broadcasterId = await getBroadcasterId();
	const pollId = interaction.options.getString('id');
	let status = interaction.options.getString('status');
	status = status.substring(0, status.indexOf(' ')).trim();
	await fetch('https://api.twitch.tv/helix/polls', {
		method: 'PATCH',
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			broadcaster_id: broadcasterId,
			id: pollId,
			status: status
		})
	}).then(res => res.json()).then(res => {
		let response = [];
		if (res.error) {
			response.push(`Error: ${res.error}`);
			response.push(`Error-Message: ${res.message}`);
		} else {
			let data = res.data[0];
			const channelPointsVoting = data.channel_points_voting_enabled ? 'enabled' : 'disabled';
			response.push(`Poll \`\`${data.title}\`\` successfully ended!`);
			const choices = buildPollChoices(false);
			response.push(`Title: ${data.title}`);
			response.push(`Poll-ID: ${data.id}`);
			response.push(`Broadcaster: ${data.broadcaster_name}`);
			response.push(`Choices:\n${choices}`);
			response.push(`Channel Points Voting ${channelPointsVoting}`);
			response.push(`Poll Status: ${data.status}`);
			response.push(`Poll Duration: ${data.duration} seconds`);
			response.push(`Started at ${toDiscordTimestamp(data.started_at)}`);
			response.push(`Ended at ${toDiscordTimestamp(data.ended_at)}`);
		}
		await interaction.editReply({
			content: response.join("\n")
		});
	}).catch(async (err) => {
		await interaction.editReply({
			content: `Error ending Poll on Twitch: ${err}`
		});
		await validate(false);
	});
}

// https://dev.twitch.tv/docs/api/reference#get-poll
async function getPoll(interaction) {
	const broadcasterId = await getBroadcasterId();
	const pollId = interaction.options.getString('id');
	await fetch(`https://api.twitch.tv/helix/polls?broadcaster_id=${broadcasterId}&id=${pollId}`, {
		method: 'GET',
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`,
			'Content-Type': 'application/json'
		}
	}).then(res => res.json()).then(res => {
		let response = [];
		if (res.error) {
			response.push(`Error: ${res.error}`);
			response.push(`Error-Message: ${res.message}`);
		} else {
			let data = res.data[0];
			const channelPointsVoting = data.channel_points_voting_enabled ? 'enabled' : 'disabled';
			response.push(`Got Poll \`\`${data.title}\`\` successfully!`);
			const choices = buildPollChoices(false);
			response.push(`Title: ${data.title}`);
			response.push(`Poll-ID: ${data.id}`);
			response.push(`Broadcaster: ${data.broadcaster_name}`);
			response.push(`Choices:\n${choices}`);
			response.push(`Channel Points Voting ${channelPointsVoting}`);
			response.push(`Poll Status: ${data.status}`);
			response.push(`Poll Duration: ${data.duration} seconds`);
			response.push(`Started at ${toDiscordTimestamp(data.started_at)}`);
		}
		await interaction.editReply({
			content: response.join("\n")
		});
	}).catch(async (err) => {
		await interaction.editReply({
			content: `Error getting Poll from Twitch: ${err}`
		});
		await validate(false);
	});
}

// https://dev.twitch.tv/docs/api/reference#create-prediction
async function createPrediction(interaction) {
	const broadcasterId = await getBroadcasterId();
	const title = interaction.options.getString('title');
	const outcomesStr = interaction.options.getString('outcomes').split(',');
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
	await fetch('https://api.twitch.tv/helix/predictions', {
		method: 'POST',
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			broadcaster_id: broadcasterId,
			title,
			outcomes: outcomesArr,
			prediction_window: duration * durationMultiplier
		})
	}).then(res => res.json()).then(res => {
		let response = [];
		if (res.error) {
			response.push(`Error: ${res.error}`);
			response.push(`Error-Message: ${res.message}`);
		} else {
			let data = res.data[0];
			response.push(`Prediction \`\`${data.title}\`\` successfully started!`);
			let outcomes = [];
			for (let i = 0; i < data.outcomes.length; i++) {
				let outcome = data.outcomes[i];
				outcomes.push(`> ${outcome.title}`);
				outcomes.push(`> > Outcome-ID: ${outcome.id}`);
				outcomes.push(`> > Outcome-Color: ${outcome.color}`);
			}
			response.push(`Title: ${data.title}`);
			response.push(`Prediction-ID: ${data.id}`);
			response.push(`Broadcaster: ${data.broadcaster_name}`);
			response.push(`Outcomes:\n${outcomes.join("\n")}`);
			response.push(`Prediction Window: ${data.prediction_window} seconds`);
			response.push(`Prediction Status: ${data.status}`);
			response.push(`Created At: ${toDiscordTimestamp(data.created_at)}`);
		}
		await interaction.editReply({
			content: response.join("\n")
		});
	}).catch(async (err) => {
		await interaction.editReply({
			content: `Error creating prediction on Twitch: ${err}`
		});
		await validate(false);
	});
}

// https://dev.twitch.tv/docs/api/reference#end-prediction
async function endPrediction(interaction) {
	const broadcasterId = await getBroadcasterId();
	let status = interaction.options.getString('status');
	status = status.substring(0, status.indexOf(' ')).trim();
	const winningOutcomeId = interaction.options.getString('winning_outcome_id') ?? undefined;
	const predictionId = interaction.options.getString('id');
	await fetch('https://api.twitch.tv/helix/predictions', {
		method: 'PATCH',
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			broadcaster_id: broadcasterId,
			id: predictionId,
			status: status,
			winning_outcome_id: winningOutcomeId
		})
	}).then(res => res.json()).then(res => {
		let response = [];
		if (res.error) {
			response.push(`Error: ${res.error}`);
			response.push(`Error-Message: ${res.message}`);
		} else {
			let data = res.data[0];
			response.push(`Prediction \`\`${data.title}\`\` successfully ended!`);
			let outcomes = '';
			for (let i = 0; i < data.outcomes.length; i++) {
				let outcome = data.outcomes[i];
				outcomes.push(`> ${outcome.title}`);
				outcomes.push(`> > Outcome-ID: ${outcome.id}`);
				outcomes.push(`> > Users: ${outcome.users}`);
				outcomes.push(`> > Channel Points: ${outcome.channel_points}`);
				outcomes.push(`> > Color: ${outcome.color}`);
				outcomes.push('> > Top Predictors:');
				for (let j = 0; outcome.top_predictors && j < outcome.top_predictors.length; j++) {
					let topPredictor = outcome.top_predictors[j].user;
					outcomes.push(`> > > User: ${topPredictor.name} (${topPredictor.id})`);
					outcomes.push(`> > > > Channel Points used: ${topPredictor.channel_points_used}`);
					outcomes.push(`> > > > Channel Points won: ${topPredictor.channel_points_won}\n`);
				}
			}
			outcomes = outcomes.trim();
			response.push(`Title: ${data.title}`);
			response.push(`Prediction-ID: ${data.id}`);
			response.push(`Broadcaster: ${data.broadcaster_name}`);
			response.push(`Outcomes:\n${outcomes}`);
			response.push(`Prediction Window: ${data.prediction_window} seconds\n`);
			response.push(`Prediction-Status: ${data.status}`);
			response.push(`Created at ${toDiscordTimestamp(data.created_at)}`);
			response.push(`Ended at ${toDiscordTimestamp(data.ended_at)}`);
			response += `Locked at ${toDiscordTimestamp(data.locked_at)}`;
		}
		await interaction.editReply({
			content: response.join("\n")
		});
	}).catch(async (err) => {
		await interaction.editReply({
			content: `Error ending prediction on Twitch: ${err}`
		});
		await validate(false);
	});
}

// https://dev.twitch.tv/docs/api/reference#get-prediction
async function getPrediction(interaction) {
	const broadcasterId = await getBroadcasterId();
	const predictionId = interaction.options.getString('id');
	await fetch(`https://api.twitch.tv/helix/predictions?broadcaster_id=${broadcasterId}&id=${predictionId}`, {
		method: 'GET',
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`,
			'Content-Type': 'application/json'
		}
	}).then(res => res.json()).then(res => {
		let response = [];
		if (res.error) {
			response.push(`Error: ${res.error}`);
			response.push(`Error-Message: ${res.message}`);
		} else {
			let data = res.data[0];
			response.push(`Got Prediction \`\`${data.title}\`\` successfully!`);
			let outcomes = '';
			for (let i = 0; i < data.outcomes.length; i++) {
				let outcome = data.outcomes[i];
				outcomes.push(`> ${outcome.title}`);
				outcomes.push(`> > Outcome-ID: ${outcome.id}`);
				outcomes.push(`> > Users: ${outcome.users}`);
				outcomes.push(`> > Channel Points: ${outcome.channel_points}`);
				outcomes.push(`> > Color: ${outcome.color}`);
				outcomes.push('> > Top Predictors:');
				for (let j = 0; outcome.top_predictors && j < outcome.top_predictors.length; j++) {
					let topPredictor = outcome.top_predictors[j].user;
					outcomes.push(`> > > User: ${topPredictor.name} (${topPredictor.id})`);
					outcomes.push(`> > > > Channel Points used: ${topPredictor.channel_points_used}`);
					outcomes.push(`> > > > Channel Points won: ${topPredictor.channel_points_won}`);
				}
			}
			outcomes = outcomes.trim();
			response.push(`Title: ${data.title}`);
			response.push(`Prediction-ID: ${data.id}`);
			response.push(`Broadcaster: ${data.broadcaster_name}`);
			response.push(`Outcomes:\n${outcomes}`);
			response.push(`Prediction Duration: ${data.prediction_window} seconds`);
			response.push(`Prediction-Status: ${data.status}`);
			response.push(`Created at ${toDiscordTimestamp(data.created_at)}`);
			response.push(`Ended at ${toDiscordTimestamp(data.ended_at)}`);
			response.push(`Locked at ${toDiscordTimestamp(data.locked_at)}`);
		}
		interaction.editReply({
			content: response.join("\n")
		});
	}).catch(async (err) => {
		interaction.editReply({
			content: `Error getting prediction from Twitch: ${err}`
		});
		await validate(false);
	});
}

/*
BOT START CODE (login, start server, etc)

This section checks if there is a TOKEN secret and uses it to login if it is found. If not, the bot outputs a log to the console and terminates.
*/

function validate(openBrowser = true) {
	return new Promise((resolve, reject) => {
		fetch('https://id.twitch.tv/oauth2/validate', {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${tokens.access_token}`
			}
		}).then(res => res.json()).then(async (res) => {
			if (res.status) {
				if (res.status == 401) {
					console.log('Trying to refresh with the refresh token');
					await fetch(`https://id.twitch.tv/oauth2/token?grant_type=refresh_token&refresh_token=${encodeURIComponent(tokens.refresh_token)}&client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}`, {
						method: 'POST',
						headers: {
							'Client-ID': process.env.TWITCH_CLIENT_ID,
							'Authorization': `Bearer ${tokens.access_token}`
						}
					}).then(res => res.json()).then(res => {
						if (res.status) {
							console.log('Failed to refresh the token! Try to reauthenticate!');
							console.log(`Status: ${res.status}`);
							console.log(`Error-Message: ${res.message}`);
							console.log(`Open the following Website to authenticate: https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}&response_type=code&scope=channel%3Aread%3Apolls%20channel%3Aread%3Apredictions%20channel%3Amanage%3Apolls%20channel%3Amanage%3Apredictions`);
							if (openBrowser)
								require('open')(`https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}&response_type=code&scope=channel%3Aread%3Apolls%20channel%3Aread%3Apredictions%20channel%3Amanage%3Apolls%20channel%3Amanage%3Apredictions`);
						} else {
							tokens = res;
							fs.writeFileSync('./.tokens.json', JSON.stringify(res));
							console.log('Tokens saved!');
							resolve('Tokens successfully refreshed!');
						}
					}).catch(err => {
						console.log('Failed to refresh the token! Try to reauthenticate!');
						console.error(err);
						console.log(`Open the following Website to authenticate: https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}&response_type=code&scope=channel%3Aread%3Apolls%20channel%3Aread%3Apredictions%20channel%3Amanage%3Apolls%20channel%3Amanage%3Apredictions`);
						if (openBrowser)
							require('open')(`https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}&response_type=code&scope=channel%3Aread%3Apolls%20channel%3Aread%3Apredictions%20channel%3Amanage%3Apolls%20channel%3Amanage%3Apredictions`);
					});
				} else {
					console.log(`Status: ${res.status}`);
					console.log(`Error-Message: ${res.message}`);
					reject("Tokens couldn't be refreshed!");
				}
			} else {
				console.log('Validating...');
				console.log(`Client-ID: ${res.client_id}`);
				console.log(`Login-Name: ${res.login}`);
				console.log(`Scopes: ${res.scopes.join(', ')}`);
				console.log(`User-ID: ${res.user_id}`);
				console.log(`Expires in: ${res.expires_in} seconds`);
				resolve('Successfully validated!');
			}
		}).catch(err => {
			reject('Validation failed!');
		});
	});
}

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
