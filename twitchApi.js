const VALIDATE_ENDPOINT = "https://id.twitch.tv/oauth2/validate";
const SCOPES = encodeURIComponent(["moderator:read:followers"].join(" "));

var tokens = {
  access_token: null,
  refresh_token: null,
  device_code: null,
  user_code: null,
  verification_uri: null,
};

async function handleDcfLogin(db, loopCallback) {
  if (db.isTokenSet(process.env.BROADCASTER_ID)) {
    let validated = await validate(db);
    if (validated) {
      console.log("Validated Tokens and started polling loop");
      await loopCallback();
      return;
    }
  }
  let dcf = await fetch(
    `https://id.twitch.tv/oauth2/device?client_id=${process.env.TWITCH_CLIENT_ID}&scopes=${SCOPES}`,
    {
      method: "POST",
    },
  );
  if (dcf.status >= 200 && dcf.status < 300) {
    // Successfully got DCF data
    let dcfJson = await dcf.json();
    tokens.device_code = dcfJson.device_code;
    tokens.user_code = dcfJson.user_code;
    tokens.verification_uri = dcfJson.verification_uri;
    console.log(
      `Open ${tokens.verification_uri} in a browser and enter ${tokens.user_code} there!`,
    );
  }
  let dcf_interval = setInterval(async () => {
    let tokenPair = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&scopes=${SCOPES}&device_code=${tokens.device_code}&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
      {
        method: "POST",
      },
    );
    if (tokenPair.status == 400) return; // Probably authorization pending
    if (tokenPair.status >= 200 && tokenPair.status < 300) {
      // Successfully got token pair
      let tokenJson = await tokenPair.json();
      tokens.access_token = tokenJson.access_token;
      tokens.refresh_token = tokenJson.refresh_token;
      db.setToken(
        process.env.BROADCASTER_ID,
        tokenJson.access_token,
        tokenJson.refresh_token,
      );
      clearInterval(dcf_interval);
      console.log("Got Device Code Flow Tokens and started polling loop");
      await loopCallback();
    }
  }, 1000);
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

async function getUser(url) {
  return (
    await fetch(url, {
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })
      .then((res) => res.json())
      .catch((err) => console.error)
  ).data[0];
}

async function getUserByLogin(login) {
  if (login) {
    return getUser(`https://api.twitch.tv/helix/users?login=${login}`);
  } else {
    return getUser(`https://api.twitch.tv/helix/users`);
  }
}

async function getUserById(id) {
  if (id) {
    return getUser(`https://api.twitch.tv/helix/users?id=${id}`);
  } else {
    return getUser(`https://api.twitch.tv/helix/users`);
  }
}

// https://dev.twitch.tv/docs/api/reference/#get-channel-followers
async function getChannelFollowers(db, broadcasterId, paginationCursor = null) {
  let apiUrl;
  if (paginationCursor) {
    apiUrl = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=100&after=${paginationCursor}`;
  } else {
    apiUrl = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=100`;
  }
  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
    },
  });
  const json = await res.json();
  if (res.status == 401) {
    console.log("Status 401");
    let refreshed = await refresh(db);
    if (!refreshed) throw new Error("Token refresh failed");
    return await getChannelFollowers(broadcasterId, paginationCursor);
  }
  if (!res.ok) {
    console.log("!res.ok: " + res.status);
    throw new Error(getStatusResponse(res, json));
  }
  if (json.error) {
    throw new Error(`Error: ${json.error}\nError-Message: ${json.message}`);
  } else {
    let result = {
      total: json.total,
      followers: [],
    };
    if (json.data) {
      result.followers = json.data;
    }
    let pagination = json.pagination;
    if (pagination.cursor) {
      let followers = await getChannelFollowers(
        broadcasterId,
        pagination.cursor,
      );
      if (followers.followers) {
        for (let follower of followers.followers) {
          result.followers.push(follower);
        }
      }
    }
    return result;
  }
}

async function refresh(db) {
  console.log("Refreshing tokens...");
  let refreshResult = await fetch(
    `https://id.twitch.tv/oauth2/token?grant_type=refresh_token&refresh_token=${encodeURIComponent(
      tokens.refresh_token,
    )}&client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${
      process.env.TWITCH_CLIENT_SECRET
    }`,
    {
      method: "POST",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${tokens.access_token}`,
      },
    },
  );
  let refreshJson = await refreshResult.json();
  if (refreshResult.status >= 200 && refreshResult.status < 300) {
    // Successfully refreshed
    tokens.access_token = refreshJson.access_token;
    tokens.refresh_token = refreshJson.refresh_token;
    db.setToken(
      process.env.BROADCASTER_ID,
      refreshJson.access_token,
      refreshJson.refresh_token,
    );
    console.log("Successfully refreshed tokens!");
    return true;
  } else {
    // Refreshing failed
    console.log(`Failed refreshing tokens: ${JSON.stringify(refreshJson)}`);
    return false;
  }
}

async function validate(db) {
  tokens = db.getToken(process.env.BROADCASTER_ID);
  return await fetch("https://id.twitch.tv/oauth2/validate", {
    method: "GET",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${tokens.access_token}`,
    },
  }).then(async (res) => {
    if (res.status) {
      if (res.status == 401) {
        return await refresh(db);
      } else if (res.status >= 200 && res.status < 300) {
        console.log("Successfully validated tokens!");
        return true;
      } else {
        console.error(
          `Unhandled validation error: ${JSON.stringify(await res.json())}`,
        );
        return false;
      }
    } else {
      console.error(
        `Unhandled network error! res.status is undefined or null! ${res}`,
      );
      return false;
    }
  });
}

export { handleDcfLogin, getUserByLogin, getUserById, getChannelFollowers };
