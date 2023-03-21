function getNoAllowedChannelIdError(channel) {
	return `Please first set a channel where you want to accept the commands! For <#${channel.id}> (${channel.name}) just set the value for \`ALLOWED_CHANNEL_ID\` to \`${channel.id}\` in the .env file!`;
}

function getChannelNotAllowedError(channel) {
	return `<#${channel.id}> (${channel.name}) is not allowed to accept commands!`;
}

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

function toDiscordTimestamp(twitchTime) {
	return `<t:${Math.floor(Date.parse(twitchTime) / 1000)}:T>`;
}

export { getNoAllowedChannelIdError, getChannelNotAllowedError, buildPollChoices, toDiscordTimestamp };
