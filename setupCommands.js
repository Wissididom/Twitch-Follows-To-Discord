require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ApplicationCommandType, ApplicationCommandOptionType } = require('discord.js');

const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages], partials: [Partials.User, Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction]});

const mySecret = process.env['DISCORD_TOKEN'];  // Discord Token

// Outputs console log when bot is logged in and registers all commands
client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);  // Logging
	let promises = [];
	promises.push(client.application?.commands?.create({
		name: 'poll',
		description: 'Create a poll for a specific Twitch channel.',
		type: ApplicationCommandType.ChatInput,
		options: [
			{
				name: 'title',
				description: 'Question displayed for the poll.',
				type: ApplicationCommandOptionType.String,
				required: true
			},
			{
				name: 'choices',
				description: 'List of the poll choices (separated by semicolon).',
				type: ApplicationCommandOptionType.String,
				required: true
			},
			{
				name: 'duration',
				description: 'Total duration for the poll (Default: in seconds).',
				type: ApplicationCommandOptionType.Integer,
				required: true
			},
			{
				name: 'unit',
				description: 'Which unit to use for duration.',
				type: ApplicationCommandOptionType.String,
				required: false,
				choices: [
					{
						name: 'minutes',
						value: 'Minutes'
					},
					{
						name: 'seconds',
						value: 'Seconds'
					}
				]
			},
			{
				name: 'channelpoints',
				description: 'Indicates if Channel Points can be used for voting.',
				type: ApplicationCommandOptionType.Boolean,
				required: false
			},
			{
				name: 'cpnumber',
				description: 'Number of Channel Points required to vote once with Channel Points.',
				type: ApplicationCommandOptionType.Integer,
				required: false
			}
		]
	}));
	promises.push(client.application?.commands?.create({
		name: 'endpoll',
		description: 'End a poll that is currently active.',
		type: ApplicationCommandType.ChatInput,
		options: [
			{
				name: 'id',
				description: 'ID of the poll.',
				type: ApplicationCommandOptionType.String,
				required: true
			},
			{
				name: 'status',
				description: 'The poll status to be set.',
				type: ApplicationCommandOptionType.String,
				required: true,
				choices: [
					{
						name: 'terminated',
						value: 'TERMINATED (End the poll manually, but allow it to be viewed publicly.)'
					},
					{
						name: 'archived',
						value: 'ARCHIVED (End the poll manually and do not allow it to be viewed publicly.)'
					}
				]
			}
		]
	}));
	promises.push(client.application?.commands?.create({
		name: 'getpoll',
		description: 'Get information about all polls or specific polls for a Twitch channel (available for 90 days).',
		type: ApplicationCommandType.ChatInput,
		options: [
			{
				name: 'id',
				description: 'ID of a poll. Filters results to one or more specific polls.',
				type: ApplicationCommandOptionType.String,
				required: true
			}
		]
	}));
	promises.push(client.application?.commands?.create({
		name: 'prediction',
		description: 'Create a Channel Points Prediction for a specific Twitch channel.',
		type: ApplicationCommandType.ChatInput,
		options: [
			{
				name: 'title',
				description: 'Title for the Prediction.',
				type: ApplicationCommandOptionType.String,
				required: true
			},
			{
				name: 'outcomes',
				description: 'List of the outcomes (separated by comma, first is blue, second is pink).',
				type: ApplicationCommandOptionType.String,
				required: true
			},
			{
				name: 'duration',
				description: 'Total duration for the Prediction (Default: in seconds).',
				type: ApplicationCommandOptionType.Integer,
				required: true
			},
			{
				name: 'unit',
				description: 'Which unit to use for duration.',
				type: ApplicationCommandOptionType.String,
				required: false,
				choices: [
					{
						name: 'minutes',
						value: 'Minutes'
					},
					{
						name: 'seconds',
						value: 'Seconds'
					}
				]
			}
		]
	}));
	promises.push(client.application?.commands?.create({
		name: 'endprediction',
		description: 'Lock, resolve, or cancel a Channel Points Prediction.',
		type: ApplicationCommandType.ChatInput,
		options: [
			{
				name: 'id',
				description: 'ID of the Prediction.',
				type: ApplicationCommandOptionType.String,
				required: true
			},
			{
				name: 'status',
				description: 'The Prediction status to be set.',
				type: ApplicationCommandOptionType.String,
				required: true,
				choices: [
					{
						name: 'resolved',
						value: 'RESOLVED (A winning outcome has been chosen and the Channel Points have been distributed.)'
					},
					{
						name: 'canceled',
						value: 'CANCELED (The Prediction has been canceled and the Channel Points have been refunded.)'
					},
					{
						name: 'locked',
						value: 'LOCKED (The Prediction has been locked and viewers can no longer make predictions.)'
					}
				]
			},
			{
				name: 'winning_outcome_id',
				description: 'ID of the winning outcome for the Prediction (Required if status is RESOLVED).',
				type: ApplicationCommandOptionType.String,
				required: false
			}
		]
	}));
	promises.push(client.application?.commands?.create({
		name: 'getprediction',
		description: 'Get information about all Channel Points Predictions or specific Channel Points Predictions.',
		type: ApplicationCommandType.ChatInput,
		options: [
			{
				name: 'id',
				description: 'ID of a poll. Filters results to one or more specific polls.',
				type: ApplicationCommandOptionType.String,
				required: true
			}
		]
	}));
	Promise.all(promises).then(reolvedPromises => {
		process.kill(process.pid, 'SIGTERM'); // Kill Bot
	});
});

/*
BOT START CODE (login, start server, etc)

This section checks if there is a TOKEN secret and uses it to login if it is found. If not, the bot outputs a log to the console and terminates.
*/

if (!mySecret) {
	console.log("TOKEN not found! You must setup the Discord TOKEN as per the README file before running this bot.");
	process.kill(process.pid, 'SIGTERM');  // Kill Bot
} else {
	// Logs in with secret TOKEN
	client.login(mySecret);
}
