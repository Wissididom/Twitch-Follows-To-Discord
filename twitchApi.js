import * as fs from 'fs';

const VALIDATE_ENDPOINT = 'https://id.twitch.tv/oauth2/validate';

var tokens = {
	access_token: 'N/A',
	refresh_token: 'N/A'
};

function setToken(token) {
	tokens = token;
}

function getStatusResponse(res, json) {
	switch (res.status) {
		case 400:
			return `Bad Request: ${json.message}`;
		case 401:
			return `Unauthorized: ${json.message}`;
		case 404:
			return `Not Found: ${json.message}`;
		case 429:
			return `Too Many Requests: ${json.message}`;
		case 500:
			return `Internal Server Error: ${json.message}`;
		default:
			return `${json.error} (${res.status}): ${json.message}`;
	}
}

async function refreshToken() {
	return await fetch(getRefreshEndpoint(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, tokens.refresh_token), {
		method: 'POST',
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`
		}
	}).then(async res => {
		let json = await res.json();
		if (!res.ok) {
			console.log('Failed to refresh the token! Try to reauthenticate!');
			console.log(`Status: ${res.status}; Error-Message: ${json.message}`);
			console.log(`Open the following Website to authenticate: ${getAuthorizationEndpoint(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, 'http://localhost', process.env.LOCAL_SERVER_PORT, getScopes())}`);
		} else {
			tokens = json;
			fs.writeFileSync('.tokens.json', JSON.stringify(json));
			console.log('Tokens saved!');
			return 'Tokens successfully refreshed!';
		}
	}).catch(err => {
		console.log('Failed to refresh the token! Try to reauthenticate!');
		console.error(err);
		console.log(`Open the following Website to authenticate: ${getAuthorizationEndpoint(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, 'http://localhost', process.env.LOCAL_SERVER_PORT, getScopes())}`);
		throw new Error('Failed to refresh token!');
	});
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
async function getChannelFollowers(broadcasterId, paginationCursor = null) {
	let apiUrl;
	if (paginationCursor) {
		apiUrl = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=100&after=${paginationCursor}`;
	} else {
		apiUrl = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=100`;
	}
	const res = await fetch(apiUrl, {
		method: 'GET',
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`,
			'Content-Type': 'application/json'
		}
	});
	const json = await res.json();
	if (res.status == 401) {
		await refreshToken();
	}
	if (!res.ok) {
		throw new Error(getStatusResponse(res, json));
	}
	if (json.error) {
		throw new Error(`Error: ${json.error}\nError-Message: ${json.message}`);
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
			let followers = await getChannelFollowers(clientId, broadcasterId, pagination.cursor);
			if (followers.followers) {
				for (let follower of followers.followers) {
					result.followers.push(follower);
				}
			}
		}
		return result;
	}
}

function getScopes() {
	const scopes = [
		'moderator:read:followers'
	];
	return scopes.join(' ');
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

async function validateTwitchToken() {
	tokens = JSON.parse(fs.readFileSync('.tokens.json', {encoding: 'utf8', flag: 'r'}));
	return await fetch(VALIDATE_ENDPOINT, {
		method: 'GET',
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`
		}
	}).then(async res => {
		let json = await res.json();
		if (res.ok) {
			tokens.expires_in = json.expires_in;
		} else {
			if (res.status == 401) {
				await refreshToken();
			} else {
				throw new Error(getStatusResponse(res, json));
			}
		}
		setInterval(() => {
			console.log(tokens.expires_in + ' seconds');
			tokens.expires_in -= 5;
		}, 5000);
	});
}

export {
	getUser,
	getChannelFollowers,
	getScopes,
	getRefreshEndpoint,
	getAuthorizationEndpoint,
	getAccessTokenByAuthTokenEndpoint,
	validateTwitchToken,
	setToken
};
