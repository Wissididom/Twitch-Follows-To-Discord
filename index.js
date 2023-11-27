import * as dotenv from 'dotenv';

import express from 'express';
import * as fs from 'fs';

import {
	getChannelFollowers,
	getScopes,
	getAuthorizationEndpoint,
	getAccessTokenByAuthTokenEndpoint,
	validateTwitchToken,
	getTokens,
	setTokens
} from './twitchApi.js';

dotenv.config();

const INCLUDE_FOLLOWS = process.env.INCLUDE_FOLLOWS.toLowerCase() == 'true';
const INCLUDE_UNFOLLOWS = process.env.INCLUDE_UNFOLLOWS.toLowerCase() == 'true';

(async () =>{
	setInterval(async () => { // Run every second
		await validateTwitchToken(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, 'http://localhost', process.env.LOCAL_SERVER_PORT, false).then(async (/*value*/) => {
			let followers = await getChannelFollowers(process.env.TWITCH_CLIENT_ID, process.env.BROADCASTER_ID);
			if (!fs.existsSync('lastFollowerList.json')) {
				fs.writeFileSync('lastFollowerList.json', `${JSON.stringify(followers, null, 4)}\n`);
				return; // Don't need to compare lists if the old list doesn't exist yet
			}
			let lastFollowerList = JSON.parse(fs.readFileSync('lastFollowerList.json', {encoding: 'utf8', flag: 'r'}));
			let followersToSkip = [];
			if (!Array.isArray(followers.followers))console.log(JSON.stringify(followers));
			for (let follower of followers.followers) {
				if (lastFollowerList.followers.find(item => {
					return item.user_id == follower.user_id;
				})) { // Follower in both lists
					followersToSkip.push(follower.user_id);
				} else {
					// Follower only in new list, aka. channel.follow
					if (!INCLUDE_FOLLOWS) continue;
					await fetch(`${process.env.DISCORD_WEBHOOK_URL}?wait=true`, {
						method: 'POST',
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({
							content: `**User Followed!**\n**Display-Name**: ${follower.user_name}\n**User-Name**: ${follower.user_login}\n**User-ID**: ${follower.user_id}`,
							allowed_mentions: [] // Do not allow any kind of pings
						})
					});
				}
			}
			for (let follower of lastFollowerList.followers) {
				if (followersToSkip.includes(follower.user_id)) continue; // Skip followers that are in both lists
				if (followers.followers.find(item => {
					return item.user_id == follower.user_id;
				})) { // Follower in both lists (shouldn't happen because of followersToSkip handling)
					followersToSkip.push(follower.user_id);
				} else {
					// Follower only in old list, aka. channel.unfollow
					if (!INCLUDE_UNFOLLOWS) continue;
					await fetch(`${process.env.DISCORD_WEBHOOK_URL}?wait=true`, {
						method: 'POST',
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({
							content: `**User Unfollowed!**\n**Display-Name**: ${follower.user_name}\n**User-Name**: ${follower.user_login}\n**User-ID**: ${follower.user_id}`,
							allowed_mentions: [] // Do not allow any kind of pings
						})
					});
				}
			}
			fs.writeFileSync('lastFollowerList.json', `${JSON.stringify(followers, null, 4)}\n`);
		}).catch(async (err) => {
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
		setTokens(authObj);
		fs.writeFileSync('.tokens.json', `${JSON.stringify(authObj)}\n`);
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
		setTokens(JSON.parse(fs.readFileSync('.tokens.json', {encoding: 'utf8', flag: 'r'})));
	}
}
