import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import Database from "./database/sqlite.js";

const handleExit = async (signal, code = 0, error = null) => {
  if (error) console.error("Uncaught Exception:", error);
  else console.log(`Received ${signal || `exit with code ${code}`}`);
  Database.close();
  process.exit(error ? 1 : code);
};

["SIGINT", "SIGTERM"].forEach((signal) =>
  process.on(signal, () => handleExit(signal)),
);
process.on("uncaughtException", (err) => handleExit(null, 1, err));
process.on("exit", async (code) => handleExit(null, code));

const readJsonFile = (filePath) =>
  existsSync(filePath) ? JSON.parse(readFileSync(filePath, "utf-8")) : null;

const migrateFollowerList = () => {
  const followers = readJsonFile("lastFollowerList.json");
  if (followers) {
    Database.saveFollowerList(followers.followers || followers);
  }
};

const migrateTokens = () => {
  const tokens = readJsonFile(".tokens.json");
  if (tokens) {
    Database.setToken(
      process.env.BROADCASTER_ID,
      tokens.access_token,
      tokens.refresh_token,
    );
  }
};

const migrations = {
  followers: existsSync("lastFollowerList.json"),
  tokens: existsSync(".tokens.json"),
};

switch (true) {
  case migrations.followers && migrations.tokens:
    console.log("Migrating lastFollowerList.json and .tokens.json...");
    migrateFollowerList();
    migrateTokens();
    break;
  case migrations.followers:
    console.log("Migrating lastFollowerList.json...");
    migrateFollowerList();
    break;
  case migrations.tokens:
    console.log("Migrating .tokens.json...");
    migrateTokens();
    break;
  default:
    console.log("No migration files found. Exiting...");
}
