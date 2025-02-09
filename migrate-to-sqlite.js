import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import Database from "./database/sqlite.js";
import { getUserById } from "./twitchApi.js";

const exitHandler = async (signal) => {
  console.log(`Received ${signal}`);
  await Database.close();
  process.exit(0);
};

process.on("SIGINT", exitHandler);
process.on("SIGTERM", exitHandler);
process.on("uncaughtException", async (err) => {
  console.error("Uncaught Exception:", err);
  await Database.close();
  process.exit(1);
});
process.on("exit", async (code) => {
  console.log(`Process exited with code: ${code}`);
  Database.close();
});

const migrateFollowerList = () => {
  const followers = JSON.parse(
    readFileSync("lastFollowerList.json", { encoding: "utf-8", flag: "r" }),
  );
  if (followers.followers) {
    Database.saveFollowerList(followers.followers);
  } else {
    Database.saveFollowerList(followers);
  }
};

const migrateTokens = () => {
  const tokens = JSON.parse(
    readFileSync(".tokens.json", { encoding: "utf-8", flag: "r" }),
  );
  Database.setToken(
    process.env.BROADCASTER_ID,
    tokens.access_token,
    tokens.refresh_token,
  );
};

if (existsSync("lastFollowerList.json")) {
  if (existsSync(".tokens.json")) {
    console.log(
      "Both lastFollowerList.json and .tokens.json were found. Migrating both...",
    );
    migrateFollowerList();
    migrateTokens();
  } else {
    console.log(
      "Only migrating lastFollowerList.json, because .tokens.json wasn't found",
    );
    migrateFollowerList();
  }
} else {
  if (existsSync(".tokens.json")) {
    console.log(
      "Only migrating .tokens.json, because lastFollowerList.json wasn't found",
    );
    migrateTokens();
  } else {
    console.log(
      "Both lastFollowerList.json and .tokens.json were not found. I don't know what to do -> Exiting!",
    );
  }
}
