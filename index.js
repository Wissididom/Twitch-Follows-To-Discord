/*
LIBRARIES
*/

require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
//const fetch = require('node-fetch');
const fs = require('fs');

/*
OBJECTS, TOKENS, GLOBAL VARIABLES
*/

const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages], partials: [Partials.User, Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction]});

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
	if (interaction.isCommand())
		handleInteraction(interaction);
});

function handleInteraction(interaction) {
	if (!process.env['ALLOWED_CHANNEL_ID']) {
		interaction.reply({
			content: `Please first set a channel where you want me to accept the commands! For <#${interaction.channel.id}> (${interaction.channel.name}) just add the line \`ALLOWED_CHANNEL_ID=${interaction.channel.id}\` to .env!`,
			ephemeral: process.env['EPHEMERAL'] == 'true'
		});
	} else if (interaction.channel.id != process.env['ALLOWED_CHANNEL_ID']) {
		interaction.reply({
			content: `<#${interaction.channel.id}> (${interaction.channel.name}) is not allowed to accept commands!`,
			ephemeral: process.env['EPHEMERAL'] == 'true'
		});
	} else {
		if (interaction.isChatInputCommand()) {
			interaction.deferReply();
			switch (interaction.commandName) {
				case 'poll':
					createPoll(interaction);
					break;
				case 'endpoll':
					endPoll(interaction);
					break;
				case 'getpoll':
					getPoll(interaction);
					break;
				case 'prediction':
					createPrediction(interaction);
					break;
				case 'endprediction':
					endPrediction(interaction);
					break;
				case 'getprediction':
					getPrediction(interaction);
					break;
			}
		}
	}
}

async function createPoll(interaction) {
	const choicesStr = interaction.options.getString('choices').split(';');
	let choicesArr = [];
	for (let i = 0; i < choicesStr.length; i++) {
		choicesArr.push({
			title: choicesStr[i].trim()
		});
	}
	const unit = interaction.options.getString('unit');
	let durationMultiplier = 1;
	if (unit && unit.toLowerCase() == 'minutes')
		durationMultiplier = 60;
	validate(false).then(async (value) => {
		fetch('https://api.twitch.tv/helix/polls', {
			method: 'POST',
			headers: {
				'Client-ID': process.env.TWITCH_CLIENT_ID,
				'Authorization': `Bearer ${tokens.access_token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				broadcaster_id: (await fetch(`https://api.twitch.tv/helix/users?login=${process.env.BROADCASTER_LOGIN}`, {
					headers: {
						'Client-ID': process.env.TWITCH_CLIENT_ID,
						'Authorization': `Bearer ${tokens.access_token}`
					}
				}).then(res => res.json()).catch(err => console.error)).data[0].id,
				title: interaction.options.getString('title'),
				choices: choicesArr,
				duration: interaction.options.getInteger('duration') * durationMultiplier,
				bits_voting_enabled: interaction.options.getBoolean('bits'),
				bits_per_vote: interaction.options.getInteger('bnumber'),
				channel_points_voting_enabled: interaction.options.getBoolean('channelpoints'),
				channel_points_per_vote: interaction.options.getInteger('cpnumber')
			})
		}).then(res => res.json()).then(res => {
			let response = 'Poll successfully started!\n';
			if (res.error) {
				response = `Error: ${res.error}\nError-Message: ${res.message}`;
			} else {
				let data = res.data[0];
				let choices = '';
				for (let i = 0; i < data.choices.length; i++) {
					choices += `> ${data.choices[i].title}\n> > Choice-ID: ${data.choices[i].id}\n`; // votes: number, channel_points_votes: number, bits_votes: number
				}
				choices = choices.trim();
				response += `Poll-ID: ${data.id}\nBroadcaster: ${data.broadcaster_name}\nTitle: ${data.title}\nChoices:\n${choices}\nBits Voting ${data.bits_voting_enabled ? 'enabled' : 'disabled'}\n`;
				response += `Bits per vote: ${data.bits_per_vote}\nChannel Points Voting ${data.channel_points_voting_enabled ? 'enabled' : 'disabled'}\nPoll Status: ${data.status}\n`;
				response += `Poll Duration: ${data.duration} seconds`; // started_at
			}
			interaction.editReply({content: response});
		}).catch(async (err) => {
			interaction.editReply({content: `Error in speaking to Twitch: ${err}\nValidating and probably requesting authorization on my hosts computer`});
			await validate(false);
		})
	}).catch((err) => {
		interaction.editReply({content: 'Token validation/refresh failed!'});
	});
}

async function endPoll(interaction) {
	let status = interaction.options.getString('status');
	status = status.substring(0, status.indexOf(' ')).trim();
	validate(false).then(async (value) => {
		fetch('https://api.twitch.tv/helix/polls', {
			method: 'PATCH',
			headers: {
				'Client-ID': process.env.TWITCH_CLIENT_ID,
				'Authorization': `Bearer ${tokens.access_token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				broadcaster_id: (await fetch(`https://api.twitch.tv/helix/users?login=${process.env.BROADCASTER_LOGIN}`, {
					headers: {
						'Client-ID': process.env.TWITCH_CLIENT_ID,
						'Authorization': `Bearer ${tokens.access_token}`
					}
				}).then(res => res.json()).catch(err => console.error)).data[0].id,
				id: interaction.options.getString('id'),
				status: status
			})
		}).then(res => res.json()).then(res => {
			let response = 'Poll successfully ended!\n';
			if (res.error) {
				response = `Error: ${res.error}\nError-Message: ${res.message}`;
			} else {
				let data = res.data[0];
				let choices = '';
				for (let i = 0; i < data.choices.length; i++) {
					let choice = data.choices[i];
					choices += `> ${choice.title}\n> > Choice-ID: ${choice.id}\n> > Votes: ${choice.votes}\n> > Channel Points Votes: ${choice.channel_points_votes}\n> > Bits Votes: ${choice.bits_votes}\n`;
				}
				choices = choices.trim();
				response += `Poll-ID: ${data.id}\nBroadcaster: ${data.broadcaster_name}\nTitle: ${data.title}\nChoices:\n${choices}\nBits Voting ${data.bits_voting_enabled ? 'enabled' : 'disabled'}\n`;
				response += `Bits per vote: ${data.bits_per_vote}\nChannel Points Voting ${data.channel_points_voting_enabled ? 'enabled' : 'disabled'}\nPoll Status: ${data.status}\n`;
				response += `Poll Duration: ${data.duration} seconds\nStarted at <t:${Math.floor(Date.parse(data.started_at) / 1000)}>\nEnded at <t:${Math.floor(Date.parse(data.ended_at) / 1000)}>`;
			}
			interaction.editReply({content: response});
		}).catch(async (err) => {
			interaction.editReply({content: `Error in speaking to Twitch: ${err}\nValidating and probably requesting authorization on my hosts computer`});
			await validate(false);
		});
	}).catch((err) => {
		interaction.editReply({content: 'Token validation/refresh failed!'});
	});
}

async function getPoll(interaction) {
	validate(false).then(async (value) => {
		let broadcaster_id = (await fetch(`https://api.twitch.tv/helix/users?login=${process.env.BROADCASTER_LOGIN}`, {
			headers: {
				'Client-ID': process.env.TWITCH_CLIENT_ID,
				'Authorization': `Bearer ${tokens.access_token}`
			}
		}).then(res => res.json()).catch(err => console.error)).data[0].id;
		let poll_id = interaction.options.getString('id');
		fetch(`https://api.twitch.tv/helix/polls?broadcaster_id=${broadcaster_id}&id=${poll_id}`, {
			method: 'GET',
			headers: {
				'Client-ID': process.env.TWITCH_CLIENT_ID,
				'Authorization': `Bearer ${tokens.access_token}`,
				'Content-Type': 'application/json'
			}
		}).then(res => res.json()).then(res => {
			let response = 'Got Poll successfully!\n';
			if (res.error) {
				response = `Error: ${res.error}\nError-Message: ${res.message}`;
			} else {
				let data = res.data[0];
				let choices = '';
				for (let i = 0; i < data.choices.length; i++) {
					let choice = data.choices[i];
					choices += `> ${choice.title}\n> > Choice-ID: ${choice.id}\n> > Votes: ${choice.votes}\n> > Channel Points Votes: ${choice.channel_points_votes}\n> > Bits Votes: ${choice.bits_votes}\n`;
				}
				choices = choices.trim();
				response += `Poll-ID: ${data.id}\nBroadcaster: ${data.broadcaster_name}\nTitle: ${data.title}\nChoices:\n${choices}\nBits Voting ${data.bits_voting_enabled ? 'enabled' : 'disabled'}\n`;
				response += `Bits per vote: ${data.bits_per_vote}\nChannel Points Voting ${data.channel_points_voting_enabled ? 'enabled' : 'disabled'}\nPoll Status: ${data.status}\n`;
				response += `Poll Duration: ${data.duration} seconds\nStarted at <t:${Math.floor(Date.parse(data.started_at) / 1000)}>`;
			}
			interaction.editReply({content: response});
		}).catch(async (err) => {
			interaction.editReply({content: `Error in speaking to Twitch: ${err}\nValidating and probably requesting authorization on my hosts computer`});
			await validate(false);
		});
	}).catch((err) => {
		interaction.editReply({content: 'Token validation/refresh failed!'});
	});
}

function createPrediction(interaction) {
	const outcomesStr = interaction.options.getString('outcomes').split(',');
	let outcomesArr = [];
	for (let i = 0; i < outcomesStr.length; i++) {
		outcomesArr.push({
			title: outcomesStr[i].trim()
		});
	}
	const unit = interaction.options.getString('unit');
	let durationMulitplier = 1;
	if (unit.toLowerCase() == 'minutes')
		durationMultiplier = 60;
	validate(false).then(async (value) => {
		fetch('https://api.twitch.tv/helix/predictions', {
			method: 'POST',
			headers: {
				'Client-ID': process.env.TWITCH_CLIENT_ID,
				'Authorization': `Bearer ${tokens.access_token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				broadcaster_id: (await fetch(`https://api.twitch.tv/helix/users?login=${process.env.BROADCASTER_LOGIN}`, {
					headers: {
						'Client-ID': process.env.TWITCH_CLIENT_ID,
						'Authorization': `Bearer ${tokens.access_token}`
					}
				}).then(res => res.json()).catch(err => console.error)).data[0].id,
				title: interaction.options.getString('title'),
				outcomes: outcomesArr,
				prediction_window: interaction.options.getInteger('duration') * durationMultiplier
			})
		}).then(res => res.json()).then(res => {
			let response = 'Prediction successfully started!\n';
			if (res.error) {
				response = `Error: ${res.error}\nError-Message: ${res.message}`;
			} else {
				let data = res.data[0];
				let outcomes = '';
				for (let i = 0; i < data.outcomes.length; i++) {
					outcomes += `> ${data.outcomes[i].title}\n> > Outcome-ID: ${data.outcomes[i].id}\n> > Outcome-Color: ${data.outcomes[i].color}\n`; // users: number, channel_points: number, top_predictors: {user: User}
				}
				outcomes = outcomes.trim();
				response += `Prediction-ID: ${data.id}\nBroadcaster: ${data.broadcaster_name}\nTitle: ${data.title}\nOutcomes:\n${outcomes}\nBits Voting ${data.bits_voting_enabled ? 'enabled' : 'disabled'}\n`;
				response += `Prediction Duration: ${data.prediction_window} seconds\nPrediction Status: ${data.status}`; // created_at, ended_at, locked_at
			}
			interaction.editReply({content: response});
		}).catch(async (err) => {
			interaction.editReply({content: `Error in speaking to Twitch: ${err}\nValidating and probably requesting authorization on my hosts computer`});
			await validate(false);
		});
	}).catch((err) => {
		interaction.editReply({content: 'Token validation/refresh failed!'});
	});
}

function endPrediction(interaction) {
	let status = interaction.options.getString('status');
	status = status.substring(0, status.indexOf(' ')).trim();
	let winning_outcome_id = interaction.options.getString('winning_outcome_id');
	validate(false).then(async (value) => {
		fetch('https://api.twitch.tv/helix/predictions', {
			method: 'PATCH',
			headers: {
				'Client-ID': process.env.TWITCH_CLIENT_ID,
				'Authorization': `Bearer ${tokens.access_token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				broadcaster_id: (await fetch(`https://api.twitch.tv/helix/users?login=${process.env.BROADCASTER_LOGIN}`, {
					headers: {
						'Client-ID': process.env.TWITCH_CLIENT_ID,
						'Authorization': `Bearer ${tokens.access_token}`
					}
				}).then(res => res.json()).catch(err => console.error)).data[0].id,
				id: interaction.options.getString('id'),
				status: status,
				winning_outcome_id: (winning_outcome_id ? winning_outcome_id : undefined)
			})
		}).then(res => res.json()).then(res => {
			let response = 'Prediction successfully ended!\n';
			if (res.error) {
				response = `Error: ${res.error}\nError-Message: ${res.message}`;
			} else {
				let data = res.data[0];
				let outcomes = '';
				for (let i = 0; i < data.outcomes.length; i++) {
					let outcome = data.outcomes[i];
					outcomes += `> ${outcome.title}\n> > Outcome-ID: ${outcome.id}\n> > Users: ${outcome.users}\n> > Channel Points: ${outcome.channel_points}\n> > Color: ${outcome.color}\n`;
					outcomes += '> > Top Predictors:\n';
					for (let j = 0; outcome.top_predictors && j < outcome.top_predictors.length; j++) {
						let topPredictor = outcome.top_predictors[j].user;
						outcomes += `> > > User: ${topPredictor.name} (${topPredictor.id})\n> > > > Channel Points used: ${topPredictor.channel_points_used}\n> > > > Channel Points won: ${topPredictor.channel_points_won}\n`;
					}
				}
				outcomes = outcomes.trim();
				response += `Prediction-ID: ${data.id}\nBroadcaster: ${data.broadcaster_name}\nTitle: ${data.title}\nOutcomes:\n${outcomes}\nPrediction Duration: ${data.prediction_window} seconds\n`;
				response += `Prediction-Status: ${data.status}\nCreated at: <t:${Math.floor(Date.parse(data.created_at) / 1000)}>\nEnded at <t:${Math.floor(Date.parse(data.ended_at) / 1000)}>\n`;
				response += `Locked at <t:${Math.floor(Date.parse(data.locked_at) / 1000)}>`;
			}
			interaction.editReply({content: response});
		}).catch(async (err) => {
			interaction.editReply({content: `Error in speaking to Twitch: ${err}\nValidating and probably requesting authorization on my hosts computer`});
			await validate(false);
		});
	}).catch((err) => {
		interaction.editReply({content: 'Token validation/refresh failed!'});
	});
}

function getPrediction(interaction) {
	validate(false).then(async (value) => {
		let broadcaster_id = (await fetch(`https://api.twitch.tv/helix/users?login=${process.env.BROADCASTER_LOGIN}`, {
			headers: {
				'Client-ID': process.env.TWITCH_CLIENT_ID,
				'Authorization': `Bearer ${tokens.access_token}`
			}
		}).then(res => res.json()).catch(err => console.error)).data[0].id;
		let prediction_id = interaction.options.getString('id');
		fetch(`https://api.twitch.tv/helix/predictions?broadcaster_id=${broadcaster_id}&id=${prediction_id}`, {
			method: 'GET',
			headers: {
				'Client-ID': process.env.TWITCH_CLIENT_ID,
				'Authorization': `Bearer ${tokens.access_token}`,
				'Content-Type': 'application/json'
			}
		}).then(res => res.json()).then(res => {
			let response = 'Got Prediction successfully!\n';
			if (res.error) {
				response = `Error: ${res.error}\nError-Message: ${res.message}`;
			} else {
				let data = res.data[0];
				let outcomes = '';
				for (let i = 0; i < data.outcomes.length; i++) {
					let outcome = data.outcomes[i];
					outcomes += `> ${outcome.title}\n> > Outcome-ID: ${outcome.id}\n> > Users: ${outcome.users}\n> > Channel Points: ${outcome.channel_points}\n> > Color: ${outcome.color}\n`;
					outcomes += '> > Top Predictors:\n';
					for (let j = 0; outcome.top_predictors && j < outcome.top_predictors.length; j++) {
						let topPredictor = outcome.top_predictors[j].user;
						outcomes += `> > > User: ${topPredictor.name} (${topPredictor.id})\n> > > > Channel Points used: ${topPredictor.channel_points_used}\n> > > > Channel Points won: ${topPredictor.channel_points_won}\n`;
					}
				}
				outcomes = outcomes.trim();
				response += `Prediction-ID: ${data.id}\nBroadcaster: ${data.broadcaster_name}\nTitle: ${data.title}\nOutcomes:\n${outcomes}\nPrediction Duration: ${data.prediction_window} seconds\n`;
				response += `Prediction-Status: ${data.status}\nCreated at: <t:${Math.floor(Date.parse(data.created_at) / 1000)}>\nEnded at <t:${Math.floor(Date.parse(data.ended_at) / 1000)}>\n`;
				response += `Locked at <t:${Math.floor(Date.parse(data.locked_at) / 1000)}>`;
			}
			interaction.editReply({content: response});
		}).catch(async (err) => {
			interaction.editReply({content: `Error in speaking to Twitch: ${err}\nValidating and probably requesting authorization on my hosts computer`});
			await validate(false);
		});
	}).catch((err) => {
		interaction.editReply({content: 'Token validation/refresh failed!'});
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
