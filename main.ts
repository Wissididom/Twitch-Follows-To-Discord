import Database from "./database/sqlite.ts";
import { SQLOutputValue } from "node:sqlite";
import { getChannelFollowers, getUser, handleDcfLogin } from "./twitchApi.ts";

const INCLUDE_FOLLOWS =
  Deno.env.get("INCLUDE_FOLLOWS")?.toLowerCase() == "true";
const INCLUDE_UNFOLLOWS =
  Deno.env.get("INCLUDE_UNFOLLOWS")?.toLowerCase() == "true";

const formatField = (
  label: string,
  value: string,
  link: string | null = null,
) => {
  return `\n**${label}**: ${
    value ? (link ? `[${value}](<${link}>)` : value) : "``(not available)``"
  }`;
};

async function buildContent(
  follower: {
    user_id: string;
    user_name: string;
    user_login: string;
    followed_at: string;
  },
  isFollow: boolean,
) {
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
    const followedAt = Math.floor(
      new Date(follower.followed_at).getTime() / 1000,
    );
    content += `\n**Followed At**: <t:${followedAt}:F> (<t:${followedAt}:R>)`;
  } else {
    content += "\n**Followed At**: ``(not available)``";
  }
  const user = follower.user_id ? await getUser(follower.user_id, "id") : null;
  if (user && user.created_at) {
    const createdAt = Math.floor(new Date(user.created_at).getTime() / 1000);
    content += `\n**Created At**: <t:${createdAt}:F> (<t:${createdAt}:R>)`;
  } else {
    content += "\n**Created At**: ``(not available)``";
  }
  return content;
}

async function postToDiscord(content: string) {
  const response = await fetch(
    `${Deno.env.get("DISCORD_WEBHOOK_URL") ?? ""}?wait=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        allowed_mentions: { parse: [] }, // Do not allow any kind of pings
      }),
    },
  );
  console.log(`Sent request for content:\n${content}`);
  if (!response.ok) {
    console.error(
      `Received error response from Discord:\n${response.status} ${response.statusText}`,
      await response.text(),
    );
  }
}

function recordToFollower(
  row: Record<string, unknown>,
): {
  user_id: string;
  user_name: string;
  user_login: string;
  followed_at: string;
} {
  if (
    typeof row.user_id !== "string" ||
    typeof row.user_name !== "string" ||
    typeof row.user_login !== "string" ||
    typeof row.followed_at !== "string"
  ) {
    throw new Error("Invalid row shape");
  }
  return {
    user_id: row.user_id,
    user_name: row.user_name,
    user_login: row.user_login,
    followed_at: row.followed_at,
  };
}

const syncFollowers = () => {
  setInterval(async () => {
    // Run every 5 seconds
    try {
      const followers = await getChannelFollowers(
        Database,
        Deno.env.get("BROADCASTER_ID")!,
      );
      const newFollowerList = followers.followers;
      const lastFollowerList = Database.getFollowers();
      if (!lastFollowerList.length) {
        // Don't need to compare lists if the old list doesn't exist yet
        return Database.saveFollowerList(newFollowerList);
      }
      const lastFollowerSet = new Set(lastFollowerList.map((f) => f.user_id));
      const addedFollowers = newFollowerList.filter(
        (
          f: {
            user_id: string;
            user_name: string;
            user_login: string;
            followed_at: string;
          },
        ) => !lastFollowerSet.has(f.user_id),
      ).map((f: Record<string, SQLOutputValue>) => recordToFollower(f));
      console.log("added:", addedFollowers);
      const removedFollowers = lastFollowerList.filter(
        (
          f: Record<string, SQLOutputValue>,
        ) =>
          !newFollowerList.some((
            nf: Record<string, SQLOutputValue>,
          ) => nf.user_id === f.user_id),
      ).map((f: Record<string, SQLOutputValue>) => recordToFollower(f));
      console.log("removed:", removedFollowers);
      for (const follower of addedFollowers) {
        Database.saveFollower(
          follower.user_id,
          follower.user_name,
          follower.user_login,
          follower.followed_at,
        );
        if (INCLUDE_FOLLOWS) {
          await postToDiscord(await buildContent(follower, true));
        }
      }
      for (const follower of removedFollowers) {
        Database.deleteFollower(
          follower.user_id,
        );
        if (INCLUDE_UNFOLLOWS) {
          await postToDiscord(await buildContent(follower, false));
        }
      }
    } catch (err) {
      console.log("Error getting followers:", err);
    }
  }, 5000);
};

const webhookGetResponse = await fetch(
  Deno.env.get("DISCORD_WEBHOOK_URL") ?? "",
);
if (webhookGetResponse.ok) {
  await handleDcfLogin(Database, syncFollowers);
} else {
  console.log(
    `Webhook response wasn't between 200 and 299 inclusive! (Status: ${webhookGetResponse.status} - ${webhookGetResponse.statusText})`,
  );
  // Discord Webhook probably doesn't exist
}
