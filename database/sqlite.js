import SQLiteDb from "better-sqlite3";

export default new (class Database {
  #db;

  constructor() {
    try {
      this.connect("./database/sqlite.db");
      console.log("Connected to the sqlite3 database");
      this.initDb();
    } catch (err) {
      console.error(err);
    }
  }

  initDb() {
    if (this.#db) {
      const tokenTableStatement = this.#db.prepare(
        "CREATE TABLE IF NOT EXISTS tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT UNIQUE, access_token TEXT, refresh_token TEXT)",
      );
      try {
        tokenTableStatement.run();
        console.log("Successfully made sure the tokens table exists");
      } catch (err) {
        console.log(`Could not make sure the tokens table exists:`, err);
      }
      const followerTableStatement = this.#db.prepare(
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

  connect(host) {
    this.close();
    this.#db = new SQLiteDb(host, {
      verbose: console.log,
    });
  }

  getToken(userId) {
    const getTokenStatement = this.#db.prepare(
      "SELECT * FROM tokens WHERE user_id = ?",
    );
    return getTokenStatement.get(userId);
  }

  setToken(userId, accessToken, refreshToken) {
    const setTokenStatement = this.#db.prepare(
      "INSERT INTO tokens (user_id, access_token, refresh_token) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET access_token = excluded.access_token, refresh_token = excluded.refresh_token WHERE user_id = excluded.user_id;",
    );
    return setTokenStatement.run(userId, accessToken, refreshToken);
  }

  saveFollower(userId, userName, userLogin, followedAt) {
    const saveFollowerStatement = this.#db.prepare(
      "INSERT INTO followers (user_id, user_name, user_login, followed_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET user_name = excluded.user_name, user_login = excluded.user_login, followed_at = excluded.followed_at WHERE user_id = excluded.user_id;",
    );
    return saveFollowerStatement.run(userId, userName, userLogin, followedAt);
  }

  async saveFollowerList(entries) {
    const saveFollowerListStatement = this.#db.prepare(
      "INSERT INTO followers (user_id, user_name, user_login, followed_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET user_name = excluded.user_name, user_login = excluded.user_login, followed_at = excluded.followed_at WHERE user_id = excluded.user_id;",
    );
    const insertMany = this.#db.transaction((followers) => {
      for (const follower of followers) {
        saveFollowerListStatement.run(
          follower.user_id,
          follower.user_name,
          follower.user_login,
          follower.followed_at,
        );
      }
    });
    insertMany(entries);
  }

  async getFollowers() {
    const getFollowersStatement = this.#db.prepare("SELECT * FROM followers;");
    return getFollowersStatement.all();
  }

  async getFollower(userId) {
    const getFollowerStatement = this.#db.prepare(
      "SELECT * FROM followers WHERE user_id = ?;",
    );
    return getFollowerStatement.get(userId);
  }

  async close() {
    if (this.#db) {
      return await new Promise((resolve, reject) => {
        this.#db.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }
})();
