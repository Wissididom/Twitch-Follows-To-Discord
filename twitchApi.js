import * as fs from 'node:fs';

import {
	buildPollChoices,
	toDiscordTimestamp
} from './util.js';

import open, {openApp, apps} from 'open';

async function getStatusResponse(res) {
	switch (res.status) {
		case 400:
			return `Bad Request: ${(await res.json()).message}`;
		case 401:
			return `Unauthorized: ${(await res.json()).message}`;
		case 404:
			return `Not Found: ${(await res.json()).message}`;
		case 429:
			return `Too Many Requests: ${(await res.json()).message}`;
		default:
			return `${(await res.json()).error} (${res.status}): ${(await res.json()).message}`;
	}
}

async function getUser(clientId, accessToken, login) {
	if (login) {
		return (await fetch(`https://api.twitch.tv/helix/users?login=${login}`, {
			headers: {
				'Client-ID': clientId,
				'Authorization': `Bearer ${accessToken}`
			}
		}).then(res => res.json()).catch(err => console.error)).data[0];
	} else {
		return (await fetch(`https://api.twitch.tv/helix/users`, {
			headers: {
				'Client-ID': clientId,
				'Authorization': `Bearer ${accessToken}`
			}
		}).then(res => res.json()).catch(err => console.error)).data[0];
	}
}



async function getBroadcaster(clientId, accessToken) {
	return await getUser(clientId, accessToken);
}

async function getBroadcasterId(clientId, accessToken) {
	return (await getBroadcaster(clientId, accessToken)).id;
}

// https://dev.twitch.tv/docs/api/reference#get-polls
async function getPoll(clientId, accessToken, broadcasterId) {
	return new Promise(async (resolve, reject) => {
		try {
			const res = await fetch(`https://api.twitch.tv/helix/polls?broadcaster_id=${broadcasterId}`, {
				method: 'GET',
				headers: {
					'Client-ID': clientId,
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				}
			});
			const json = await res.json();
			if (!res.ok) {
				resolve(getStatusResponse(res));
				return;
			}
			let response = [];
			if (json.error) {
				response.push(`Error: ${json.error}`);
				response.push(`Error-Message: ${json.message}`);
			} else {
				if (json.data.length < 1) {
					resolve('No Poll found');
					return;
				}
				let data = json.data[0];
				const channelPointsVoting = data.channel_points_voting_enabled ? 'enabled' : 'disabled';
				response.push(`Got Poll \`\`${data.title}\`\` successfully!`);
				const choices = buildPollChoices(data, false);
				response.push(`Title: ${data.title}`);
				response.push(`Poll-ID: ${data.id}`);
				response.push(`Broadcaster: ${data.broadcaster_name}`);
				response.push(`Choices:\n${choices}`);
				response.push(`Channel Points Voting ${channelPointsVoting}`);
				response.push(`Poll Status: ${data.status}`);
				response.push(`Poll Duration: ${data.duration} seconds`);
				response.push(`Started at ${toDiscordTimestamp(data.started_at)}`);
			}
			resolve(response.join("\n"));
		} catch (e) {
			reject(e);
		}
	});
}

// https://dev.twitch.tv/docs/api/reference#get-polls
async function getPollId(clientId, accessToken, broadcasterId) {
	return new Promise(async (resolve, reject) => {
		try {
			const res = await fetch(`https://api.twitch.tv/helix/polls?broadcaster_id=${broadcasterId}`, {
				method: 'GET',
				headers: {
					'Client-ID': clientId,
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				}
			});
			const json = await res.json();
			if (!res.ok) {
				resolve(getStatusResponse(res));
				return;
			}
			if (json.error) {
				reject(`Error: ${json.error}; Error-Message: ${json.message}`);
			} else {
				if (json.data.length < 1) {
					reject('No Poll found');
					return;
				}
				resolve(json.data[0].id);
			}
		} catch (e) {
			reject(e);
		}
	});
}

// https://dev.twitch.tv/docs/api/reference#create-poll
async function createPoll(clientId, accessToken, broadcasterId, title, choices, duration, channelPointsVotingEnabled, channelPointsPerVote) {
	return new Promise(async (resolve, reject) => {
		try {
			const res = await fetch('https://api.twitch.tv/helix/polls', {
				method: 'POST',
				headers: {
					'Client-ID': clientId,
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					broadcaster_id: broadcasterId,
					title,
					choices,
					duration,
					channel_points_voting_enabled: channelPointsVotingEnabled,
					channel_points_per_vote: channelPointsPerVote
				})
			});
			const json = await res.json();
			if (!res.ok) {
				resolve(getStatusResponse(res));
				return;
			}
			const response = [];
			if (json.error) {
				response.push(`Error: ${json.error}`);
				response.push(`Error-Message: ${json.message}`);
				console.log(`Error: ${JSON.stringify(json)}`);
			} else {
				if (json.data.length < 1) {
					resolve('No Poll created');
					return;
				}
				const data = json.data[0];
				const channelPointsVoting = data.channel_points_voting_enabled ? 'enabled' : 'disabled';
				response.push(`Poll \`\`${data.title}\`\` successfully started!\n`);
				const choices = buildPollChoices(data, true);
				response.push(`Title: ${data.title}`);
				response.push(`Poll-ID: ${data.id}`);
				response.push(`Broadcaster: ${data.broadcaster_name}`);
				response.push(`Choices:\n${choices}`);
				response.push(`Channel Points Voting ${channelPointsVoting}`);
				response.push(`Poll Status: ${data.status}`);
				response.push(`Poll Duration: ${data.duration} seconds`);
				response.push(`Started At: ${toDiscordTimestamp(data.started_at)}`);
			}
			resolve(response.join("\n"));
		} catch (e) {
			reject(e);
		}
	});
}

// https://dev.twitch.tv/docs/api/reference#end-poll
async function endPoll(clientId, accessToken, broadcasterId, pollId, status) {
	return new Promise(async (resolve, reject) => {
		try {
			const res = await fetch('https://api.twitch.tv/helix/polls', {
				method: 'PATCH',
				headers: {
					'Client-ID': clientId,
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					broadcaster_id: broadcasterId,
					id: pollId,
					status
				})
			});
			const json = await res.json();
			if (!res.ok) {
				resolve(getStatusResponse(res));
				return;
			}
			let response = [];
			if (json.error) {
				response.push(`Error: ${json.error}`);
				response.push(`Error-Message: ${json.message}`);
			} else {
				if (json.data.length < 1) {
					resolve('Poll not found');
					return;
				}
				let data = json.data[0];
				const channelPointsVoting = data.channel_points_voting_enabled ? 'enabled' : 'disabled';
				response.push(`Poll \`\`${data.title}\`\` successfully ended!`);
				const choices = buildPollChoices(data, false);
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
			resolve(response.join("\n"));
		} catch (e) {
			reject(e);
		}
	});
}

// https://dev.twitch.tv/docs/api/reference#get-predictions
async function getPrediction(clientId, accessToken, broadcasterId) {
	return new Promise(async (resolve, reject) => {
		try {
			const res = await fetch(`https://api.twitch.tv/helix/predictions?broadcaster_id=${broadcasterId}`, {
				method: 'GET',
				headers: {
					'Client-ID': clientId,
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				}
			});
			const json = await res.json();
			if (!res.ok) {
				resolve(getStatusResponse(res));
				return;
			}
			let response = [];
			if (json.error) {
				response.push(`Error: ${json.error}`);
				response.push(`Error-Message: ${json.message}`);
			} else {
				if (json.data.length < 1) {
					resolve('No Prediction found');
					return;
				}
				let data = json.data[0];
				response.push(`Got Prediction \`\`${data.title}\`\` successfully!`);
				let outcomes = [];
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
				outcomes = outcomes.join("\n").trim();
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
			resolve(response.join("\n"));
		} catch (e) {
			reject(e);
		}
	});
}

// https://dev.twitch.tv/docs/api/reference#get-predictions
async function getPredictionId(clientId, accessToken, broadcasterId) {
	return new Promise(async (resolve, reject) => {
		try {
			const res = await fetch(`https://api.twitch.tv/helix/predictions?broadcaster_id=${broadcasterId}`, {
				method: 'GET',
				headers: {
					'Client-ID': clientId,
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				}
			});
			const json = await res.json();
			if (!res.ok) {
				resolve(getStatusResponse(res));
				return;
			}
			if (json.error) {
				reject(`Error: ${json.error}; Error-Message: ${json.message}`);
			} else {
				if (json.data.length < 1) {
					reject('No Prediction found');
					return;
				}
				resolve(json.data[0].id);
			}
		} catch (e) {
			reject(e);
		}
	});
}

// https://dev.twitch.tv/docs/api/reference#create-prediction
async function createPrediction(clientId, accessToken, broadcasterId, title, outcomes, predictionWindow) {
	return new Promise(async (resolve, reject) => {
		try {
			const res = await fetch('https://api.twitch.tv/helix/predictions', {
				method: 'POST',
				headers: {
					'Client-ID': clientId,
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					broadcaster_id: broadcasterId,
					title,
					outcomes,
					prediction_window: predictionWindow
				})
			});
			const json = await res.json();
			if (!res.ok) {
				resolve(getStatusResponse(res));
				return;
			}
			let response = [];
			if (json.error) {
				response.push(`Error: ${json.error}`);
				response.push(`Error-Message: ${json.message}`);
			} else {
				let data = json.data[0];
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
			resolve(response.join("\n"));
		} catch (e) {
			reject(e);
		}
	});
}

// https://dev.twitch.tv/docs/api/reference#end-prediction
async function endPrediction(clientId, accessToken, broadcasterId, predictionId, status, winningOutcomeId) {
	return new Promise(async (resolve, reject) => {
		try {
			const res = await fetch('https://api.twitch.tv/helix/predictions', {
				method: 'PATCH',
				headers: {
					'Client-ID': process.env.TWITCH_CLIENT_ID,
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					broadcaster_id: broadcasterId,
					id: predictionId,
					status: status,
					winning_outcome_id: winningOutcomeId
				})
			});
			const json = await res.json();
			if (!res.ok) {
				resolve(getStatusResponse(res));
				return;
			}
			let response = [];
			if (json.error) {
				response.push(`Error: ${json.error}`);
				response.push(`Error-Message: ${json.message}`);
			} else {
				let data = json.data[0];
				response.push(`Prediction \`\`${data.title}\`\` successfully ended!`);
				let outcomes = [];
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
				outcomes = outcomes.join("\n").trim();
				response.push(`Title: ${data.title}`);
				response.push(`Prediction-ID: ${data.id}`);
				response.push(`Broadcaster: ${data.broadcaster_name}`);
				response.push(`Outcomes:\n${outcomes}`);
				response.push(`Prediction Window: ${data.prediction_window} seconds\n`);
				response.push(`Prediction-Status: ${data.status}`);
				response.push(`Created at ${toDiscordTimestamp(data.created_at)}`);
				response.push(`Ended at ${toDiscordTimestamp(data.ended_at)}`);
				response.push(`Locked at ${toDiscordTimestamp(data.locked_at)}`);
			}
			resolve(response.join("\n"));
		} catch (e) {
			reject(e);
		}
	});
}

function getScopes() {
	const scopes = [
		'channel:read:polls',
		'channel:read:predictions',
		'channel:manage:polls',
		'channel:manage:predictions'
	];
	return scopes.join(' ');
}

function getValidationEndpoint() {
	return 'https://id.twitch.tv/oauth2/validate';
}

function getRefreshEndpoint(clientId, clientSecret, refreshToken) {
	return `https://id.twitch.tv/oauth2/token?grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=${clientId}&client_secret=${clientSecret}`;
}

function getAuthorizationEndpoint(clientId, clientSecret, redirectUri, port, scopes) {
	return `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}%3A${port}&response_type=code&scope=${scopes}`;
}

function getAccessTokenByAuthTokenEndpoint(clientId, clientSecret, code, redirectUri, port) {
	return `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&code=${code}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(redirectUri)}%3A${port}`;
}

function validateTwitchToken(clientId, clientSecret, tokens, redirectUri, port, openBrowser = true) {
	return new Promise(async (resolve, reject) => {
		await fetch(getValidationEndpoint(), {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${tokens.access_token}`
			}
		}).then(res => res.json()).then(async res => {
			if (res.status) {
				if (res.status == 401) {
					console.log('Trying to refresh with the refresh token');
					await fetch(getRefreshEndpoint(clientId, clientSecret, tokens.refresh_token), {
						method: 'POST',
						headers: {
							'Client-ID': clientId,
							'Authorization': `Bearer ${tokens.access_token}`
						}
					}).then(res => res.json()).then(res => {
						if (res.status) {
							console.log('Failed to refresh the token! Try to reauthenticate!');
							console.log(`Status: ${res.status}`);
							console.log(`Error-Message: ${res.message}`);
							console.log(`Open the following Website to authenticate: ${getAuthorizationEndpoint(clientId, clientSecret, redirectUri, port, getScopes())}`);
							if (openBrowser)
								open(getAuthorizationEndpoint(clientId, clientSecret, redirectUri, port, getScopes()));
						} else {
							tokens = res;
							fs.writeFileSync('./.tokens.json', JSON.stringify(res));
							console.log('Tokens saved!');
							resolve('Tokens successfully refreshed!');
						}
					}).catch(err => {
						console.log('Failed to refresh the token! Try to reauthenticate!');
						console.error(err);
						console.log(`Open the following Website to authenticate: ${getAuthorizationEndpoint(clientId, clientSecret, redirectUri, port, getScopes())}`);
						if (openBrowser)
							open(getAuthorizationEndpoint(clientId, clientSecret, redirectUri, port, getScopes()));
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

export {
	getUser,
	getBroadcaster,
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
	getValidationEndpoint,
	getRefreshEndpoint,
	getAuthorizationEndpoint,
	getAccessTokenByAuthTokenEndpoint,
	validateTwitchToken
};
