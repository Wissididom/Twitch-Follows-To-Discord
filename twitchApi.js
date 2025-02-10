const VALIDATE_ENDPOINT = "https://id.twitch.tv/oauth2/validate";
const SCOPES = encodeURIComponent(["moderator:read:followers"].join(" "));

var tokens = {
  access_token: null,
  refresh_token: null,
  device_code: null,
  user_code: null,
  verification_uri: null,
};

async function fetchTwitchApi(url, method = "GET", body = null) {
  const headers = {
    "Client-ID": process.env.TWITCH_CLIENT_ID,
    Authorization: `Bearer ${tokens.access_token}`,
    "Content-Type": "application/json",
  };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${res.status} ${json.message || res.statusText}`);
  }
  return json;
}

async function handleDcfLogin(db, loopCallback) {
  if (db.isTokenSet(process.env.BROADCASTER_ID) && (await validate(db))) {
    console.log("Validated Tokens. Starting loop...");
    return await loopCallback();
  }
  let dcf = await fetch(
    `https://id.twitch.tv/oauth2/device?client_id=${process.env.TWITCH_CLIENT_ID}&scopes=${SCOPES}`,
    {
      method: "POST",
    },
  );
  if (!dcf.ok) throw new Error("Failed to retrieve device code");
  const dcfJson = await dcf.json();
  Object.assign(tokens, dcfJson);
  console.log(
    `Open ${tokens.verification_uri} in a browser and enter ${tokens.user_code}!`,
  );
  const dcfInterval = setInterval(async () => {
    let tokenRes = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&scopes=${SCOPES}&device_code=${tokens.device_code}&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
      {
        method: "POST",
      },
    );
    if (tokenRes.status === 400) return; // Probably authorization pending
    if (tokenRes.ok) {
      const tokenJson = await tokenRes.json();
      Object.assign(tokens, tokenJson);
      db.setToken(
        process.env.BROADCASTER_ID,
        tokens.access_token,
        tokens.refresh_token,
      );
      clearInterval(dcfInterval);
      console.log("Device Code Flow Tokens obtained. Starting loop...");
      await loopCallback();
    }
  }, 1000);
}

async function getUser(identifier, type = "login") {
  if (identifier) {
    return (
      await fetchTwitchApi(
        `https://api.twitch.tv/helix/users?${type}=${identifier}`,
      )
    ).data[0];
  } else {
    return (await fetchTwitchApi("https://api.twitch.tv/helix/users")).data[0];
  }
}

// https://dev.twitch.tv/docs/api/reference/#get-channel-followers
async function getChannelFollowers(db, broadcasterId, paginationCursor = null) {
  let apiUrl = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=100`;
  if (paginationCursor) {
    apiUrl += `&after=${paginationCursor}`;
  }
  try {
    const json = await fetchTwitchApi(apiUrl);
    let followers = json.data || [];
    if (json.pagination?.cursor) {
      followers = followers.concat(
        (await getChannelFollowers(db, broadcasterId, json.pagination.cursor))
          .followers,
      );
    }
    return { total: json.total, followers };
  } catch (err) {
    if (err.message.startsWith("401")) {
      console.log("Token expired. Refreshing...");
      if (!(await refresh(db))) throw new Error("Token refresh failed");
      return await getChannelFollowers(db, broadcasterId, paginationCursor);
    }
    throw err;
  }
}

async function refresh(db) {
  console.log("Refreshing tokens...");
  try {
    const json = await fetchTwitchApi(
      `https://id.twitch.tv/oauth2/token?grant_type=refresh_token&refresh_token=${encodeURIComponent(
        tokens.refresh_token,
      )}&client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${
        process.env.TWITCH_CLIENT_SECRET
      }`,
      "POST",
    );
    Object.assign(tokens, json);
    db.setToken(
      process.env.BROADCASTER_ID,
      tokens.access_token,
      tokens.refresh_token,
    );
    console.log("Tokens refreshed successfully!");
    return true;
  } catch (err) {
    console.error("Token refresh failed:", err.message);
    return false;
  }
}

async function validate(db) {
  tokens = db.getToken(process.env.BROADCASTER_ID);
  try {
    await fetchTwitchApi(VALIDATE_ENDPOINT);
    console.log("Tokens validated successfully!");
    return true;
  } catch (err) {
    return err.message.startsWith("401") ? await refresh(db) : false;
  }
}

export { handleDcfLogin, getUser, getChannelFollowers };
