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

function toDiscordTimestamp(twitchTime) {
	return `<t:${Math.floor(Date.parse(twitchTime) / 1000)}>`;
}
function validate(openBrowser = true) {
	return new Promise(async (resolve, reject) => {
		await fetch('https://id.twitch.tv/oauth2/validate', {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${tokens.access_token}`
			}
		}).then(res => res.json()).then(async res => {
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

module.exports.getNoAllowedChannelIdError = getNoAllowedChannelIdError;
module.exports.getChannelNotAllowedError = getChannelNotAllowedError;
module.exports.getBroadcaster = getBroadcaster;
module.exports.getBroadcasterId = getBroadcasterId;
module.exports.toDiscordTimestamp = toDiscordTimestamp;
module.exports.validate = validate;
