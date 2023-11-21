import * as dotenv from 'dotenv';

import {
	Client,
	GatewayIntentBits,
	Partials
} from 'discord.js';
import express from 'express';
import * as fs from 'node:fs';
import open, {openApp, apps} from 'open';

import {
	getBroadcasterId,
	getChannelFollowers,
	getScopes,
	getAuthorizationEndpoint,
	getAccessTokenByAuthTokenEndpoint,
	validateTwitchToken
} from './twitchApi.js';

dotenv.config();

const mySecret = process.env.DISCORD_TOKEN;

let tokens = {
	access_token: 'N/A',
	refresh_token: 'N/A'
};

setInterval(() => { // Run every second
	await validateTwitchToken(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, tokens, 'http://localhost', process.env.LOCAL_SERVER_PORT, false).then(async (/*value*/) => {
		const broadcasterId = await getBroadcasterId(process.env.TWITCH_CLIENT_ID, tokens.access_token);
		await getChannelFollowers(process.env.TWITCH_CLIENT_ID, tokens.access_token, broadcasterId).then(async followers => {
			let result = "user_id;user_name;user_login;followed_at;total\n";
			for (let follower of followers) {
				result += `${follower.user_id};${follower.user_name};${follower.user_login};${follower.followed_at};`;
			}
			result += `;;;;${followers.total}\n`;
			// TODO: Compare with last file and save if there are differences
		}).catch(async err => {
			console.log(err);
		});
	}).catch(async (err) => {
		await interaction.editReply({
			content: `Token validation failed! (${err})`
		});
		console.trace(err);
	});
}, 1000);

const server = express();
server.all('/', async (req, res) => {
	const authObj = await fetch(getAccessTokenByAuthTokenEndpoint(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, req.query.code, 'http://localhost', process.env.LOCAL_SERVER_PORT), {
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
		console.log(`Open the following Website to authenticate: ${getAuthorizationEndpoint(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, 'http://localhost', process.env.LOCAL_SERVER_PORT, getScopes())}`);
		open(getAuthorizationEndpoint(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, 'http://localhost', process.env.LOCAL_SERVER_PORT, getScopes()));
	}
});
if (!mySecret) {
	console.log("TOKEN not found! You must setup the Discord TOKEN as per the README file before running this bot.");
	process.kill(process.pid, 'SIGTERM');  // Kill Bot
} else {
	if (fs.existsSync('./.tokens.json')) {
		tokens = JSON.parse(fs.readFileSync('./.tokens.json', {encoding: 'utf8', flag: 'r'}));
		validateTwitchToken(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, tokens, 'http://localhost', process.env.LOCAL_SERVER_PORT).then(() => {
			// Logs in with secret TOKEN
			client.login(mySecret);
		}).catch(() => {
			console.log('Failed to validate token, refresh token or authenticate!');
			process.kill(process.pid, 'SIGTERM');
		});
	}
}
