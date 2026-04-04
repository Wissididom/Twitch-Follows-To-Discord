import { DatabaseSync } from "node:sqlite";

export default new (class Database {
  private db: DatabaseSync;

  constructor() {
    this.close();
    this.db = new DatabaseSync("./database/sqlite.db", {
      open: true,
    });
    console.log("Connected to the SQLite database");
    this.initDb();
  }

  initDb() {
    if (this.db) {
      const tokenTableStatement = this.db.prepare(
        "CREATE TABLE IF NOT EXISTS tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT UNIQUE, access_token TEXT, refresh_token TEXT)",
      );
      try {
        tokenTableStatement.run();
        console.log("Successfully made sure the tokens table exists");
      } catch (err) {
        console.log(`Could not make sure the tokens table exists:`, err);
      }
      const followerTableStatement = this.db.prepare(
        "CREATE TABLE IF NOT EXISTS followers (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT UNIQUE, user_name TEXT, user_login INT, followed_at TEXT)",
      );
      try {
        followerTableStatement.run();
        console.log("Successfully made sure the followers table exists");
      } catch (err) {
        console.log(`Could not make sure the followers table exists:`, err);
      }
    }
  }

  connect(host: string) {
    this.close();
    this.db = new DatabaseSync(host, {
      open: true,
    });
  }

  getToken(userId: string) {
    const getTokenStatement = this.db.prepare(
      "SELECT * FROM tokens WHERE user_id = ?",
    );
    return getTokenStatement.get(userId);
  }

  isTokenSet(userId: string) {
    const tokenSetStatement = this.db.prepare(
      "SELECT COUNT(*) AS tokenCount FROM tokens WHERE user_id = ?;",
    );
    const tokenCount = tokenSetStatement.get(userId)?.tokenCount;
    return ((tokenCount as number) ?? 0) > 0;
  }

  setToken(userId: string, accessToken: string, refreshToken: string) {
    const setTokenStatement = this.db.prepare(
      "INSERT INTO tokens (user_id, access_token, refresh_token) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET access_token = excluded.access_token, refresh_token = excluded.refresh_token WHERE user_id = excluded.user_id;",
    );
    return setTokenStatement.run(userId, accessToken, refreshToken);
  }

  getFollowerCount() {
    const followerCountStatement = this.db.prepare(
      "SELECT COUNT(*) AS followerCount FROM followers;",
    );
    const followers = followerCountStatement.get();
    return followers?.followerCount as number ?? 0;
  }

  saveFollower(
    userId: string,
    userName: string,
    userLogin: string,
    followedAt: string,
  ) {
    const saveFollowerStatement = this.db.prepare(
      "INSERT INTO followers (user_id, user_name, user_login, followed_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET user_name = excluded.user_name, user_login = excluded.user_login, followed_at = excluded.followed_at WHERE user_id = excluded.user_id;",
    );
    return saveFollowerStatement.run(userId, userName, userLogin, followedAt);
  }

  deleteFollower(userId: string) {
    const deleteFollowerStatement = this.db.prepare(
      "DELETE FROM followers WHERE user_id = ?;",
    );
    return deleteFollowerStatement.run(userId);
  }

  saveFollowerList(
    followers: {
      user_id: string;
      user_name: string;
      user_login: string;
      followed_at: string;
    }[],
  ) {
    const saveFollowerListStatement = this.db.prepare(
      "INSERT INTO followers (user_id, user_name, user_login, followed_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET user_name = excluded.user_name, user_login = excluded.user_login, followed_at = excluded.followed_at WHERE user_name IS NOT excluded.user_name OR user_login IS NOT excluded.user_login OR followed_at IS NOT excluded.followed_at;",
    );
    this.db.exec("BEGIN");
    try {
      for (const follower of followers) {
        saveFollowerListStatement.run(
          follower.user_id,
          follower.user_name,
          follower.user_login,
          follower.followed_at,
        );
      }
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  getFollowers() {
    const getFollowersStatement = this.db.prepare("SELECT * FROM followers;");
    return getFollowersStatement.all();
  }

  getFollower(userId: string) {
    const getFollowerStatement = this.db.prepare(
      "SELECT * FROM followers WHERE user_id = ?;",
    );
    return getFollowerStatement.get(userId);
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
})();
