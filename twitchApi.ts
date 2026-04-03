const VALIDATE_ENDPOINT = "https://id.twitch.tv/oauth2/validate";
const SCOPES = encodeURIComponent(["moderator:read:followers"].join(" "));

let tokens = {
  access_token: null,
  refresh_token: null,
  device_code: null,
  user_code: null,
  verification_uri: null,
};

async function fetchTwitchApi(
  url: string,
  method: string = "GET",
  body: any = null,
) {
  const headers = {
    "Client-ID": Deno.env.get("TWITCH_CLIENT_ID"),
    Authorization: `Bearer ${tokens.access_token}`,
    "Content-Type": "application/json",
  };
  const options = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${res.status} ${json.message || res.statusText}`);
  }
  return json;
}

async function handleDcfLogin(db: any, loopCallback: any) {
  if (db.isTokenSet(Deno.env.get("BROADCASTER_ID")) && (await validate(db))) {
    console.log("Validated Tokens. Starting loop...");
    return await loopCallback();
  }
  const dcf = await fetch(
    `https://id.twitch.tv/oauth2/device?client_id=${
      Deno.env.get("TWITCH_CLIENT_ID")
    }&scopes=${SCOPES}`,
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
    const tokenRes = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${
        Deno.env.get("TWITCH_CLIENT_ID")
      }&scopes=${SCOPES}&device_code=${tokens.device_code}&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
      {
        method: "POST",
      },
    );
    if (tokenRes.status === 400) return; // Probably authorization pending
    if (tokenRes.ok) {
      const tokenJson = await tokenRes.json();
      Object.assign(tokens, tokenJson);
      db.setToken(
        Deno.env.get("BROADCASTER_ID"),
        tokens.access_token,
        tokens.refresh_token,
      );
      clearInterval(dcfInterval);
      console.log("Device Code Flow Tokens obtained. Starting loop...");
      await loopCallback();
    }
  }, 1000);
}

async function getUser(identifier: string, type: string = "login") {
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
async function getChannelFollowers(
  db: any,
  broadcasterId: string,
  paginationCursor: string | null = null,
) {
  let apiUrl =
    `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=100`;
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
    if ((err as any).message.startsWith("401")) {
      console.log("Token expired. Refreshing...");
      if (!(await refresh(db))) throw new Error("Token refresh failed");
      return await getChannelFollowers(db, broadcasterId, paginationCursor);
    }
    throw err;
  }
}

async function refresh(db: any) {
  console.log("Refreshing tokens...");
  try {
    const json = await fetchTwitchApi(
      `https://id.twitch.tv/oauth2/token?grant_type=refresh_token&refresh_token=${
        encodeURIComponent(
          tokens.refresh_token ?? "",
        )
      }&client_id=${Deno.env.get("TWITCH_CLIENT_ID")}&client_secret=${
        Deno.env.get("TWITCH_CLIENT_SECRET")
      }`,
      "POST",
    );
    Object.assign(tokens, json);
    db.setToken(
      Deno.env.get("BROADCASTER_ID"),
      tokens.access_token,
      tokens.refresh_token,
    );
    console.log("Tokens refreshed successfully!");
    return true;
  } catch (err) {
    console.error("Token refresh failed:", (err as any).message);
    return false;
  }
}

async function validate(db: any) {
  tokens = db.getToken(Deno.env.get("BROADCASTER_ID"));
  try {
    await fetchTwitchApi(VALIDATE_ENDPOINT);
    console.log("Tokens validated successfully!");
    return true;
  } catch (err) {
    return (err as any).message.startsWith("401") ? await refresh(db) : false;
  }
}

export { getChannelFollowers, getUser, handleDcfLogin };
