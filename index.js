import "dotenv/config";
import Database from "./database/sqlite.js";
import { handleDcfLogin, getChannelFollowers, getUser } from "./twitchApi.js";

const INCLUDE_FOLLOWS = process.env.INCLUDE_FOLLOWS.toLowerCase() == "true";
const INCLUDE_UNFOLLOWS = process.env.INCLUDE_UNFOLLOWS.toLowerCase() == "true";

const formatField = (label, value, link = null) => {
  return `\n**${label}**: ${value ? (link ? `[${value}](<${link}>)` : value) : "``(not available)``"}`;
};

async function buildContent(follower, isFollow) {
  let content = isFollow ? "**User Followed!**" : "**User Unfollowed!**";
  content += formatField(
    "Display-Name",
    follower.user_name,
    `https://www.twitch.tv/${follower.user_login}`,
  );
  content += formatField(
    "User-Name",
    follower.user_login,
    `https://www.twitch.tv/${follower.user_login}`,
  );
  content += formatField(
    "User-ID",
    follower.user_id,
    `https://www.twitch.tv/${follower.user_login}`,
  );
  if (follower.followed_at) {
    let followedAt = Math.floor(
      new Date(follower.followed_at).getTime() / 1000,
    );
    content += `\n**Followed At**: <t:${followedAt}:F> (<t:${followedAt}:R>)`;
  } else {
    content += "\n**Followed At**: ``(not available)``";
  }
  let user = follower.user_id ? await getUser(follower.user_id, "id") : null;
  if (user && user.created_at) {
    let createdAt = Math.floor(new Date(user.created_at).getTime() / 1000);
    content += `\n**Created At**: <t:${createdAt}:F> (<t:${createdAt}:R>)`;
  } else {
    content += "\n**Created At**: ``(not available)``";
  }
  return content;
}

async function postToDiscord(content) {
  const response = await fetch(`${process.env.DISCORD_WEBHOOK_URL}?wait=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      allowed_mentions: { parse: [] }, // Do not allow any kind of pings
    }),
  });
  if (!response.ok) {
    console.error(
      `${response.status} ${response.statusText}`,
      await response.text(),
    );
  }
}

const syncFollowers = async () => {
  setInterval(async () => {
    // Run every 5 seconds
    try {
      const followers = await getChannelFollowers(
        Database,
        process.env.BROADCASTER_ID,
      );
      const newFollowerList = followers.followers;
      const lastFollowerList = Database.getFollowers();
      if (!lastFollowerList.length) {
        // Don't need to compare lists if the old list doesn't exist yet
        return Database.saveFollowerList(newFollowerList);
      }
      const lastFollowerSet = new Set(lastFollowerList.map((f) => f.user_id));
      const addedFollowers = newFollowerList.filter(
        (f) => !lastFollowerSet.has(f.user_id),
      );
      console.log("added:", addedFollowers);
      const removedFollowers = lastFollowerList.filter(
        (f) => !newFollowerList.some((nf) => nf.user_id === f.user_id),
      );
      console.log("removed:", removedFollowers);
      for (const follower of addedFollowers) {
        Database.saveFollower(
          follower.user_id,
          follower.user_name,
          follower.user_login,
          follower.followed_at,
        );
        if (INCLUDE_FOLLOWS)
          await postToDiscord(await buildContent(follower, true));
      }
      for (const follower of removedFollowers) {
        Database.deleteFollower(
          follower.user_id,
          follower.user_name,
          follower.user_login,
          follower.followed_at,
        );
        if (INCLUDE_UNFOLLOWS)
          await postToDiscord(await buildContent(follower, false));
      }
    } catch (err) {
      console.log("Error getting followers:", err);
    }
  }, 5000);
};

if ((await fetch(process.env.DISCORD_WEBHOOK_URL)).ok) {
  await handleDcfLogin(Database, syncFollowers);
} else {
  console.log(
    `Webhook response wasn't between 200 and 299 inclusive! (Status: ${webhookGetResponse.status} - ${webhookGetResponse.statusText})`,
  );
  // Discord Webhook probably doesn't exist
}
