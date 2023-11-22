import * as dotenv from 'dotenv';

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

let tokens = {
	access_token: 'N/A',
	refresh_token: 'N/A'
};

(async () =>{
	setInterval(async () => { // Run every second
		await validateTwitchToken(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, tokens, 'http://localhost', process.env.LOCAL_SERVER_PORT, false).then(async (/*value*/) => {
			const broadcasterId = await getBroadcasterId(process.env.TWITCH_CLIENT_ID, tokens.access_token);
			await getChannelFollowers(process.env.TWITCH_CLIENT_ID, tokens.access_token, broadcasterId).then(async followers => {
				fs.writeFileSync('lastFollowerList.json', JSON.stringify(followers, null, 4));
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
	}, 5000);
})();

const server = express();
server.all('/', async (req, res) => {
	const authObj = await fetch(getAccessTokenByAuthTokenEndpoint(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, req.query.code, 'http://localhost', process.env.LOCAL_SERVER_PORT), {
		method: 'POST'
	}).then(res => res.json()).catch(err => console.error);
	if (authObj.access_token) {
		tokens = authObj;
		fs.writeFileSync('.tokens.json', JSON.stringify(authObj));
		res.send('<html>Tokens saved!</html>');
		console.log('Tokens saved!');
	} else { 
		res.send("Couldn't get the access token!");
		console.log("Couldn't get the access token!");
	}	
});
server.listen(parseInt(process.env.LOCAL_SERVER_PORT), () => {
	console.log('Express Server ready!');
	if (!fs.existsSync('.tokens.json')) {
		console.log(`Open the following Website to authenticate: ${getAuthorizationEndpoint(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, 'http://localhost', process.env.LOCAL_SERVER_PORT, getScopes())}`);
	}
});
if (!(await fetch(process.env.DISCORD_WEBHOOK_URL)).ok) {
	console.log("Webhook response wasn't between 200 and 299 inclusive!");
	process.kill(process.pid, 'SIGTERM');  // Kill Bot
} else {
	if (fs.existsSync('.tokens.json')) {
		tokens = JSON.parse(fs.readFileSync('.tokens.json', {encoding: 'utf8', flag: 'r'}));
	}
}
