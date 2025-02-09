import "dotenv/config";
import Database from "./database/sqlite.js";
import {
  handleDcfLogin,
  getChannelFollowers,
  getUserById,
} from "./twitchApi.js";

const INCLUDE_FOLLOWS = process.env.INCLUDE_FOLLOWS.toLowerCase() == "true";
const INCLUDE_UNFOLLOWS = process.env.INCLUDE_UNFOLLOWS.toLowerCase() == "true";

async function buildContent(follower, follow) {
  let content = follow ? "**User Followed!**" : "**User Unfollowed!**";
  if (follower.user_name) {
    content += `\n**Display-Name**: [${follower.user_name}](<https://www.twitch.tv/${follower.user_login}>)`;
  } else {
    content += "\n**Display-Name**: ``(not available)``";
  }
  if (follower.user_login) {
    content += `\n**User-Name**: [${follower.user_login}](<https://www.twitch.tv/${follower.user_login}>)`;
  } else {
    content += "\n**User-Name**: ``(not available)``";
  }
  if (follower.user_id) {
    content += `\n**User-ID**: [${follower.user_id}](<https://www.twitch.tv/${follower.user_login}>)`;
  } else {
    content += "\n**User-ID**: ``(not available)``";
  }
  if (follower.followed_at) {
    let followedAt = new Date(follower.followed_at).getTime() / 1000;
    content += `\n**Followed At**: <t:${followedAt}:F> (<t:${followedAt}:R>)`;
  } else {
    content += "\n**Followed At**: ``(not available)``";
  }
  let user = follower.user_id ? await getUserById(follower.user_id) : null;
  if (user && user.created_at) {
    let createdAt = new Date(user.created_at).getTime() / 1000;
    content += `\n**Created At**: <t:${createdAt}:F> (<t:${createdAt}:R>)`;
  } else {
    content += "\n**Created At**: ``(not available)``";
  }
  return content;
}

async function postToDiscord(content) {
  return await fetch(`${process.env.DISCORD_WEBHOOK_URL}?wait=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      allowed_mentions: { parse: [] }, // Do not allow any kind of pings
    }),
  });
}

async function outputIfNotOk(response) {
  if (!response.ok) {
    console.log(`${response.status} ${response.statusText}`);
    console.log(await response.text());
  }
}

var loop = async () => {
  setInterval(async () => {
    // Run every 5 seconds
    let followers = await getChannelFollowers(
      Database,
      process.env.BROADCASTER_ID,
    );
    if (Database.getFollowerCount() < 1) {
      Database.saveFollowerList(followers.followers);
      return; // Don't need to compare lists if the old list doesn't exist yet
    }
    let lastFollowerList = Database.getFollowers();
    let followersToSkip = [];
    for (let follower of followers.followers) {
      if (
        lastFollowerList.find((item) => {
          return item.user_id == follower.user_id;
        })
      ) {
        // Follower in both lists
        followersToSkip.push(follower.user_id);
      } else {
        // Follower only in new list, aka. channel.follow
        Database.saveFollower(
          follower.user_id,
          follower.user_name,
          follower.user_login,
          follower.followed_at,
        );
        if (!INCLUDE_FOLLOWS) continue;
        let content = await buildContent(follower, true);
        let response = await postToDiscord(content);
        await outputIfNotOk(response);
      }
    }
    for (let follower of lastFollowerList) {
      if (followersToSkip.includes(follower.user_id)) continue; // Skip followers that are in both lists
      if (
        followers.followers.find((item) => {
          return item.user_id == follower.user_id;
        })
      ) {
        // Follower in both lists (shouldn't happen because of followersToSkip handling)
        followersToSkip.push(follower.user_id);
      } else {
        // Follower only in old list, aka. channel.unfollow
        Database.deleteFollower(
          follower.user_id,
          follower.user_name,
          follower.user_login,
          follower.followed_at,
        );
        if (!INCLUDE_UNFOLLOWS) continue;
        let content = await buildContent(follower, false);
        let response = await postToDiscord(content);
        await outputIfNotOk(response);
      }
    }
  }, 5000);
};

let webhookGetResponse = await fetch(process.env.DISCORD_WEBHOOK_URL);
if (webhookGetResponse.ok) {
  await handleDcfLogin(Database, loop);
} else {
  console.log(
    `Webhook response wasn't between 200 and 299 inclusive! (Status: ${webhookGetResponse.status} - ${webhookGetResponse.statusText})`,
  );
  // Discord Webhook probably doesn't exist
}
