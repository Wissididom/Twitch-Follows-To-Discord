require('dotenv').config();
const { Client, Intents, Constants } = require('discord.js');

const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES], partials: ['USER', 'CHANNEL', 'GUILD_MEMBER', 'MESSAGE', 'REACTION']}); // Discord Object

const mySecret = process.env['DISCORD_TOKEN'];  // Discord Token

// Outputs console log when bot is logged in and registers all commands
client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);  // Logging
	let promises = [];
	promises.push(client.application?.commands?.create({
		name: 'poll',
		description: 'Create a poll for a specific Twitch channel.',
		options: [
			{
				name: 'title',
				description: 'Question displayed for the poll.',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				required: true
			},
			{
				name: 'choices',
				description: 'List of the poll choices (separated by semicolon).',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				required: true
			},
			{
				name: 'duration',
				description: 'Total duration for the poll (Default: in seconds).',
				type: Constants.ApplicationCommandOptionTypes.INTEGER,
				required: true
			},
			{
				name: 'unit',
				description: 'Which unit to use for duration.',
				type: Constants.ApplicationCommandOptionTypes.STRING,
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
				name: 'bits',
				description: 'Indicates if Bits can be used for voting.',
				type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
				required: false
			},
			{
				name: 'bnumber',
				description: 'Number of Bits required to vote once with Bits.',
				type: Constants.ApplicationCommandOptionTypes.INTEGER,
				required: false
			},
			{
				name: 'channelpoints',
				description: 'Indicates if Channel Points can be used for voting.',
				type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
				required: false
			},
			{
				name: 'cpnumber',
				description: 'Number of Channel Points required to vote once with Channel Points.',
				type: Constants.ApplicationCommandOptionTypes.INTEGER,
				required: false
			}
		]
	}));
	promises.push(client.application?.commands?.create({
		name: 'endpoll',
		description: 'End a poll that is currently active.',
		options: [
			{
				name: 'id',
				description: 'ID of the poll.',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				required: true
			},
			{
				name: 'status',
				description: 'The poll status to be set.',
				type: Constants.ApplicationCommandOptionTypes.STRING,
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
		options: [
			{
				name: 'id',
				description: 'ID of a poll. Filters results to one or more specific polls.',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				required: true
			}
		]
	}));
	promises.push(client.application?.commands?.create({
		name: 'prediction',
		description: 'Create a Channel Points Prediction for a specific Twitch channel.',
		options: [
			{
				name: 'title',
				description: 'Title for the Prediction.',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				required: true
			},
			{
				name: 'outcomes',
				description: 'List of the outcomes (separated by comma, first is blue, second is pink).',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				required: true
			},
			{
				name: 'duration',
				description: 'Total duration for the Prediction (Default: in seconds).',
				type: Constants.ApplicationCommandOptionTypes.INTEGER,
				required: true
			},
			{
				name: 'unit',
				description: 'Which unit to use for duration.',
				type: Constants.ApplicationCommandOptionTypes.STRING,
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
		options: [
			{
				name: 'id',
				description: 'ID of the Prediction.',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				required: true
			},
			{
				name: 'status',
				description: 'The Prediction status to be set.',
				type: Constants.ApplicationCommandOptionTypes.STRING,
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
				type: Constants.ApplicationCommandOptionTypes.STRING,
				required: false
			}
		]
	}));
	promises.push(client.application?.commands?.create({
		name: 'getprediction',
		description: 'Get information about all Channel Points Predictions or specific Channel Points Predictions.',
		options: [
			{
				name: 'id',
				description: 'ID of a poll. Filters results to one or more specific polls.',
				type: Constants.ApplicationCommandOptionTypes.STRING,
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
