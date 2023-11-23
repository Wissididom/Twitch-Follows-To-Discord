import * as fs from 'node:fs';

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

// https://dev.twitch.tv/docs/api/reference/#get-channel-followers
async function getChannelFollowers(clientId, accessToken, broadcasterId, paginationCursor = null) {
	let apiUrl;
	if (paginationCursor) {
		apiUrl = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=100&after=${paginationCursor}`;
	} else {
		apiUrl = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=100`;
	}
	return new Promise(async (resolve, reject) => {
		try {
			const res = await fetch(apiUrl, {
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
				resolve(`Error: ${json.error}\nError-Message: ${json.message}`);
			} else {
				let result = {
					total: json.total,
					followers: []
				};
				if (json.data) {
					result.followers = json.data;
				}
				let pagination = json.pagination;
				if (pagination.cursor) {
					let followers = await getChannelFollowers(clientId, accessToken, broadcasterId, pagination.cursor);
					if (followers.data) {
						for (let follower of followers.data) {
							result.followers.push(follower);
						}
					}
				}
				resolve(result);
			}
		} catch (e) {
			reject(e);
		}
	});
}

function getScopes() {
	const scopes = [
		'moderator:read:followers'
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
							fs.writeFileSync('.tokens.json', JSON.stringify(res));
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
	getChannelFollowers,
	getScopes,
	getValidationEndpoint,
	getRefreshEndpoint,
	getAuthorizationEndpoint,
	getAccessTokenByAuthTokenEndpoint,
	validateTwitchToken
};
