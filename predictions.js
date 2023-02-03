const { getBroadcasterId, toDiscordTimestamp, validate } = require('./util');

// https://dev.twitch.tv/docs/api/reference#create-prediction
async function createPrediction(interaction) {
	const broadcasterId = await getBroadcasterId();
	const title = interaction.options.getString('title');
	const outcomesStr = interaction.options.getString('outcomes').split(',');
	let outcomesArr = [];
	for (let i = 0; i < outcomesStr.length; i++) {
		outcomesArr.push({
			title: outcomesStr[i].trim()
		});
	}
	const duration = interaction.options.getInteger('duration');
	const unit = interaction.options.getString('unit');
	let durationMulitplier = 1;
	if (unit.toLowerCase() == 'minutes')
		durationMultiplier = 60;
	await fetch('https://api.twitch.tv/helix/predictions', {
		method: 'POST',
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			broadcaster_id: broadcasterId,
			title,
			outcomes: outcomesArr,
			prediction_window: duration * durationMultiplier
		})
	}).then(res => res.json()).then(async res => {
		let response = [];
		if (res.error) {
			response.push(`Error: ${res.error}`);
			response.push(`Error-Message: ${res.message}`);
		} else {
			let data = res.data[0];
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
		await interaction.editReply({
			content: response.join("\n")
		});
	}).catch(async (err) => {
		await interaction.editReply({
			content: `Error creating prediction on Twitch: ${err}`
		});
		await validate(false);
	});
}

// https://dev.twitch.tv/docs/api/reference#end-prediction
async function endPrediction(interaction) {
	const broadcasterId = await getBroadcasterId();
	let status = interaction.options.getString('status');
	status = status.substring(0, status.indexOf(' ')).trim();
	const winningOutcomeId = interaction.options.getString('winning_outcome_id') ?? undefined;
	const predictionId = interaction.options.getString('id');
	await fetch('https://api.twitch.tv/helix/predictions', {
		method: 'PATCH',
		headers: {
			'Client-ID': process.env.TWITCH_CLIENT_ID,
			'Authorization': `Bearer ${tokens.access_token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			broadcaster_id: broadcasterId,
			id: predictionId,
			status: status,
			winning_outcome_id: winningOutcomeId
		})
	}).then(res => res.json()).then(async res => {
		let response = [];
		if (res.error) {
			response.push(`Error: ${res.error}`);
			response.push(`Error-Message: ${res.message}`);
		} else {
			let data = res.data[0];
			response.push(`Prediction \`\`${data.title}\`\` successfully ended!`);
			let outcomes = '';
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
			outcomes = outcomes.trim();
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
		await interaction.editReply({
			content: response.join("\n")
		});
	}).catch(async (err) => {
		await interaction.editReply({
			content: `Error ending prediction on Twitch: ${err}`
		});
		await validate(false);
	});
}

// https://dev.twitch.tv/docs/api/reference#get-prediction
async function getPrediction(interaction) {
	const broadcasterId = await getBroadcasterId();
	const predictionId = interaction.options.getString('id');
	await fetch(`https://api.twitch.tv/helix/predictions?broadcaster_id=${broadcasterId}&id=${predictionId}`, {
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
			response.push(`Got Prediction \`\`${data.title}\`\` successfully!`);
			let outcomes = '';
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
			outcomes = outcomes.trim();
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
		await interaction.editReply({
			content: response.join("\n")
		});
	}).catch(async (err) => {
		await interaction.editReply({
			content: `Error getting prediction from Twitch: ${err}`
		});
		await validate(false);
	});
}

module.exports.createPrediction = createPrediction;
module.exports.endPrediction = endPrediction;
module.exports.getPrediction = getPrediction;
