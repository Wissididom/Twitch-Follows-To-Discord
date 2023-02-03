const { getBroadcasterId, toDiscordTimestamp, validate } = require('./util');

function buildPollChoices(data, create) {
	let response = [];
	let choices = '';
	for (let i = 0; i < data.choices.length; i++) {
		let choice = data.choices[i];
		response.push(`> ${choice.title}`);
		response.push(`> > Choice-ID: ${choice.id}`);
		if (!create) {
			response.push(`> > Votes: ${choice.votes}`);
			response.push(`> > Channel Points Votes: ${choice.channel_points_votes}`);
			response.push(`> > Bits Votes: ${choice.bits_votes}\n`);
		}
	}
	choices = choices.trim();
	return response.join("\n");
}

// https://dev.twitch.tv/docs/api/reference#create-poll
async function createPoll(interaction) {
	const broadcasterId = await getBroadcasterId();
	const title = interaction.options.getString('title');
	const choicesStr = interaction.options.getString('choices').split(';');
	let choicesArr = [];
	for (let i = 0; i < choicesStr.length; i++) {
		choicesArr.push({
			title: choicesStr[i].trim()
		});
	}
	const duration = interaction.options.getInteger('duration');
	const unit = interaction.options.getString('unit');
	let durationMultiplier = 1;
	if (unit && unit.toLowerCase() == 'minutes')
		durationMultiplier = 60;
	const channelPointsVotingEnabled = interaction.options.getBoolean('channelpoints');
	const channelPointsPerVote = interaction.options.getBoolean('cpnumber');
	await fetch('https://api.twitch.tv/helix/polls', {
		method: 'POST',
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			broadcaster_id: broadcasterId,
			title: title,
			choices: choicesArr,
			duration: duration * durationMultiplier,
			channel_points_voting_enabled: channelPointsVotingEnabled,
			channel_points_per_vote: channelPointsPerVote
		})
	}).then(res => res.json()).then(async res => {
		let response = [];
		if (res.error) {
			response.push(`Error: ${res.error}`);
			response.push(`Error-Message: ${res.message}`);
		} else {
			const data = res.data[0];
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
		await interaction.editReply({
			content: response.join("\n")
		});
	}).catch(async (err) => {
		await interaction.editReply({
			content: `Error creating Poll on Twitch: ${err}`
		});
		await validate(false);
	});
}

// https://dev.twitch.tv/docs/api/reference#end-poll
async function endPoll(interaction) {
	const broadcasterId = await getBroadcasterId();
	const pollId = interaction.options.getString('id');
	let status = interaction.options.getString('status');
	status = status.substring(0, status.indexOf(' ')).trim();
	await fetch('https://api.twitch.tv/helix/polls', {
		method: 'PATCH',
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			broadcaster_id: broadcasterId,
			id: pollId,
			status: status
		})
	}).then(res => res.json()).then(async res => {
		let response = [];
		if (res.error) {
			response.push(`Error: ${res.error}`);
			response.push(`Error-Message: ${res.message}`);
		} else {
			let data = res.data[0];
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
		await interaction.editReply({
			content: response.join("\n")
		});
	}).catch(async (err) => {
		await interaction.editReply({
			content: `Error ending Poll on Twitch: ${err}`
		});
		await validate(false);
	});
}

// https://dev.twitch.tv/docs/api/reference#get-poll
async function getPoll(interaction) {
	const broadcasterId = await getBroadcasterId();
	const pollId = interaction.options.getString('id');
	await fetch(`https://api.twitch.tv/helix/polls?broadcaster_id=${broadcasterId}&id=${pollId}`, {
		method: 'GET',
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`,
			'Content-Type': 'application/json'
		}
	}).then(res => res.json()).then(async res => {
		let response = [];
		if (res.error) {
			response.push(`Error: ${res.error}`);
			response.push(`Error-Message: ${res.message}`);
		} else {
			let data = res.data[0];
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
		await interaction.editReply({
			content: response.join("\n")
		});
	}).catch(async (err) => {
		await interaction.editReply({
			content: `Error getting Poll from Twitch: ${err}`
		});
		await validate(false);
	});
}

module.exports.createPoll = createPoll;
module.exports.endPoll = endPoll;
module.exports.getPoll = getPoll;
