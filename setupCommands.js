import * as dotenv from 'dotenv';

import {
	Client,
	GatewayIntentBits,
	Partials,
	ApplicationCommandType,
	ApplicationCommandOptionType
} from 'discord.js';

dotenv.config();

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

// Outputs console log when bot is logged in and registers all commands
client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);  // Logging
	let promises = [];
	promises.push(client.application?.commands?.create({
		name: 'getpoll',
		nameLocalizations: {
			de: 'umfrageabrufen'
		},
		description: 'Get information about the most recent poll in the authorized Twitch channel',
		descriptionLocalizations: {
			de: 'Informationen über die letzte Umfrage des authorisierten Twitch-Kanals abrufen'
		},
		type: ApplicationCommandType.ChatInput
	}));
	promises.push(client.application?.commands?.create({
		name: 'poll',
		nameLocalizations: {
			de: 'umfrage'
		},
		description: 'Create a poll in the authorized Twitch channel',
		descriptionLocalizations: {
			de: 'Eine Umfrage im authorisierten Twitch-Kanal erstellen'
		},
		type: ApplicationCommandType.ChatInput,
		options: [
			{
				name: 'title',
				nameLocalizations: {
					de: 'frage'
				},
				description: 'Title displayed in the poll',
				descriptionLocalizations: {
					de: 'Der Titel, der in der Umfrage angezeigt werden soll'
				},
				type: ApplicationCommandOptionType.String,
				required: true
			},
			{
				name: 'choices',
				nameLocalizations: {
					de: 'antworten'
				},
				description: 'List of the poll choices (separated by semicolon)',
				descriptionLocalizations: {
					de: 'Eine Liste an Antwortmöglichkeiten (getrennt durch Strichpunkte/Semikolon)'
				},
				type: ApplicationCommandOptionType.String,
				required: true
			},
			{
				name: 'duration',
				nameLocalizations: {
					de: 'dauer'
				},
				description: 'Total duration for the poll (Default: in seconds).',
				descriptionLocalizations: {
					de: 'Gesamtdauer der Umfrage (Standardmäßig in Sekunden)'
				},
				type: ApplicationCommandOptionType.Integer,
				required: true
			},
			{
				name: 'unit',
				nameLocalizations: {
					de: 'einheit'
				},
				description: 'Which unit to use for the duration',
				descriptionLocalizations: {
					de: 'Welche Einheit soll für die Dauer genutzt werden'
				},
				type: ApplicationCommandOptionType.String,
				required: false,
				choices: [
					{
						name: 'Minutes',
						nameLocalizations: {
							de: 'Minuten'
						},
						value: 'minutes'
					},
					{
						name: 'Seconds',
						nameLocalizations: {
							de: 'Sekunden'
						},
						value: 'seconds'
					}
				]
			},
			{
				name: 'channelpoints',
				nameLocalizations: {
					de: 'kanalpunkte'
				},
				description: 'Indicates if Channel Points can be used for voting',
				descriptionLocalizations: {
					de: 'Gibt an, ob Kanalpunkte für die Abstimmung verwendet werden können'
				},
				type: ApplicationCommandOptionType.Boolean,
				required: false
			},
			{
				name: 'cpnumber',
				nameLocalizations: {
					de: 'kpanzahl'
				},
				description: 'Number of Channel Points required to vote once with Channel Points.',
				descriptionLocalizations: {
					de: 'Anzahl der Kanalpunkte, die für eine Stimme mit Kanalpunkten benötigt wird'
				},
				type: ApplicationCommandOptionType.Integer,
				required: false
			}
		]
	}));
	promises.push(client.application?.commands?.create({
		name: 'endpoll',
		nameLocalizations: {
			de: 'umfragebeenden'
		},
		description: 'End the poll that is currently active',
		descriptionLocalizations: {
			de: 'Die Umfrage, die aktuell läuft, beenden'
		},
		type: ApplicationCommandType.ChatInput,
		options: [
			{
				name: 'status',
				nameLocalizations: {
					de: 'status'
				},
				description: 'The poll status to be set',
				descriptionLocalizations: {
					de: 'Der Status, auf den die Umfrage gesetzt werden soll'
				},
				type: ApplicationCommandOptionType.String,
				required: true,
				choices: [
					{
						name: 'Terminated (End the poll manually, but allow it to be viewed publicly)',
						nameLocalizations: {
							de: 'Beendet (Umfrage manuell beenden, aber öffentlich sichtbar lassen)'
						},
						value: 'TERMINATED'
					},
					{
						name: 'Archived (End the poll manually and do not allow it to be viewed publicly)',
						nameLocalizations: {
							de: 'Archiviert (Umfrage manuell beenden und auf privat stellen)'
						},
						value: 'ARCHIVED'
					}
				]
			}
		]
	}));
	promises.push(client.application?.commands?.create({
		name: 'getprediction',
		nameLocalizations: {
			de: 'vorhersageabrufen'
		},
		description: 'Get information about the most recent prediction in the authorized Twitch channel',
		descriptionLocalizations: {
			de: 'Informationen über die letzte Vorhersage des authorisierten Twitch-Kanals abrufen'
		},
		type: ApplicationCommandType.ChatInput
	}));
	promises.push(client.application?.commands?.create({
		name: 'prediction',
		nameLocalizations: {
			de: 'vorhersage'
		},
		description: 'Create a prediction in the authorized Twitch channel',
		descriptionLocalizations: {
			de: 'Eine Vorhersage im authorisierten Twitch-Kanal erstellen'
		},
		type: ApplicationCommandType.ChatInput,
		options: [
			{
				name: 'title',
				nameLocalizations: {
					de: 'titel'
				},
				description: 'Title for the prediction',
				descriptionLocalizations: {
					de: 'Titel für die Vorhersage'
				},
				type: ApplicationCommandOptionType.String,
				required: true
			},
			{
				name: 'outcomes',
				nameLocalizations: {
					de: 'ergebnisse'
				},
				description: 'List of the outcomes (separated by semicolon)',
				descriptionLocalizations: {
					de: 'Liste der möglichen Ergebnisse (getrennt durch Strichpunkte/Semikolon)'
				},
				type: ApplicationCommandOptionType.String,
				required: true
			},
			{
				name: 'duration', // prediction window
				nameLocalizations: {
					de: 'dauer'
				},
				description: 'Total duration for the prediction (Default: in seconds)',
				descriptionLocalizations: {
					de: 'Gesamtdauer der Vorhersage (Standardmäßig in Sekunden)'
				},
				type: ApplicationCommandOptionType.Integer,
				required: true
			},
			{
				name: 'unit',
				nameLocalizations: {
					de: 'einheit'
				},
				description: 'Which unit to use for duration',
				descriptionLocalizations: {
					de: 'Welche Einheit soll für die Dauer genutzt werden'
				},
				type: ApplicationCommandOptionType.String,
				required: false,
				choices: [
					{
						name: 'Minutes',
						nameLocalizations: {
							de: 'Minuten'
						},
						value: 'minutes'
					},
					{
						name: 'Seconds',
						nameLocalizations: {
							de: 'Sekunden'
						},
						value: 'seconds'
					}
				]
			}
		]
	}));
	promises.push(client.application?.commands?.create({
		name: 'endprediction',
		nameLocalizations: {
			de: 'vorhersagebeeenden'
		},
		description: 'Lock, resolve, or cancel a prediction',
		descriptionLocalizations: {
			de: 'Eine Vorhersage sperren, auflösen oder abbrechen'
		},
		type: ApplicationCommandType.ChatInput,
		options: [
			{
				name: 'status',
				/*nameLocalizations: {
					de: 'status'
				},*/
				description: 'The prediction status to be set',
				descriptionLocalizations: {
					de: 'Der Status, auf den die Vorhersage gesetzt werden soll'
				},
				type: ApplicationCommandOptionType.String,
				required: true,
				choices: [
					{
						name: 'Resolved (A winning outcome has been chosen and the Channel Points have been distributed)',
						nameLocalizations: {
							de: 'Aufgelöst (Ein Gewinner wurde ausgewählt und die Kanalpunkte wurden verteilt)'
						},
						value: 'RESOLVED'
					},
					{
						name: 'Canceled (The prediction has been canceled and the Channel Points have been refunded)',
						nameLocalizations: {
							de: 'Abgebrochen (Die Vorhersage wurde abgebrochen und die Kanalpunkte wurden zurückerstattet)'
						},
						value: 'CANCELED'
					},
					{
						name: 'Locked (The prediction has been locked and viewers can no longer make predictions)',
						nameLocalizations: {
							de: 'Gesperrt (Die Vorhersage wurde gesperrt und Zuschauer können nicht länger vorhersagen)'
						},
						value: 'LOCKED'
					}
				]
			},
			{
				name: 'winning_outcome_id',
				nameLocalizations: {
					de: 'gewinnendes_ergebnis_id'
				},
				description: 'ID of the winning outcome for the prediction (Required if status is "Resolved")',
				descriptionLocalizations: {
					de: 'ID des Ergebnisses, welches die Vorhersage gewinnen soll (Erforderlich, wenn status "Aufgelöst" ist)'
				},
				type: ApplicationCommandOptionType.String,
				required: false
			}
		]
	}));
	Promise.all(promises).then((/*resolvedPromises*/) => {
		process.kill(process.pid, 'SIGTERM'); // Kill Bot
	});
});

if (!mySecret) {
	console.log("TOKEN not found! You must setup the Discord TOKEN as per the README file before running this bot.");
	process.kill(process.pid, 'SIGTERM');  // Kill Bot
} else {
	// Logs in with secret TOKEN
	client.login(mySecret);
}
