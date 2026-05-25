package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

type Database struct {
	db *sql.DB
}

func NewDatabase(dbPath string) *Database {
	d := &Database{}
	d.connect(dbPath)
	d.initDB()
	return d
}

func (d *Database) connect(dbPath string) {
	var err error
	d.db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	if err := d.db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected to the SQLite database")
}

func (d *Database) initDB() {
	// Create tokens table
	tokenTableSQL := `CREATE TABLE IF NOT EXISTS tokens (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id TEXT UNIQUE,
		access_token TEXT,
		refresh_token TEXT
	);`

	if _, err := d.db.Exec(tokenTableSQL); err != nil {
		log.Printf("Could not create tokens table: %v", err)
	} else {
		log.Println("Successfully made sure the tokens table exists")
	}

	// Create followers table
	followerTableSQL := `CREATE TABLE IF NOT EXISTS followers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id TEXT UNIQUE,
		user_name TEXT,
		user_login TEXT,
		followed_at TEXT
	);`

	if _, err := d.db.Exec(followerTableSQL); err != nil {
		log.Printf("Could not create followers table: %v", err)
	} else {
		log.Println("Successfully made sure the followers table exists")
	}
}

func (d *Database) getToken(userID string) map[string]interface{} {
	row := d.db.QueryRow("SELECT id, user_id, access_token, refresh_token FROM tokens WHERE user_id = ?", userID)

	var id int
	var uid, accessToken, refreshToken sql.NullString

	if err := row.Scan(&id, &uid, &accessToken, &refreshToken); err != nil {
		if err == sql.ErrNoRows {
			return nil
		}
		log.Printf("Error querying token: %v", err)
		return nil
	}

	result := make(map[string]interface{})
	result["id"] = id
	result["user_id"] = uid.String
	result["access_token"] = accessToken.String
	result["refresh_token"] = refreshToken.String

	return result
}

func (d *Database) isTokenSet(userID string) bool {
	var count int
	err := d.db.QueryRow("SELECT COUNT(*) FROM tokens WHERE user_id = ?", userID).Scan(&count)
	if err != nil {
		log.Printf("Error checking token: %v", err)
		return false
	}
	return count > 0
}

func (d *Database) setToken(userID, accessToken, refreshToken string) error {
	stmt, err := d.db.Prepare(`
		INSERT INTO tokens (user_id, access_token, refresh_token) VALUES (?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
		access_token = excluded.access_token,
		refresh_token = excluded.refresh_token
		WHERE user_id = excluded.user_id;
	`)
	if err != nil {
		return fmt.Errorf("prepare error: %w", err)
	}
	defer stmt.Close()

	_, err = stmt.Exec(userID, accessToken, refreshToken)
	return err
}

func (d *Database) getFollowerCount() int {
	var count int
	err := d.db.QueryRow("SELECT COUNT(*) FROM followers").Scan(&count)
	if err != nil {
		log.Printf("Error getting follower count: %v", err)
		return 0
	}
	return count
}

func (d *Database) saveFollower(userID, userName, userLogin, followedAt string) error {
	stmt, err := d.db.Prepare(`
		INSERT INTO followers (user_id, user_name, user_login, followed_at) VALUES (?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
		user_name = excluded.user_name,
		user_login = excluded.user_login,
		followed_at = excluded.followed_at
		WHERE user_id = excluded.user_id;
	`)
	if err != nil {
		return fmt.Errorf("prepare error: %w", err)
	}
	defer stmt.Close()

	_, err = stmt.Exec(userID, userName, userLogin, followedAt)
	return err
}

func (d *Database) deleteFollower(userID string) error {
	stmt, err := d.db.Prepare("DELETE FROM followers WHERE user_id = ?")
	if err != nil {
		return fmt.Errorf("prepare error: %w", err)
	}
	defer stmt.Close()

	_, err = stmt.Exec(userID)
	return err
}

type Follower struct {
	UserID     string `json:"user_id"`
	UserName   string `json:"user_name"`
	UserLogin  string `json:"user_login"`
	FollowedAt string `json:"followed_at"`
}

func (d *Database) saveFollowerList(followers []Follower) error {
	stmt, err := d.db.Prepare(`
		INSERT INTO followers (user_id, user_name, user_login, followed_at) VALUES (?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
		user_name = excluded.user_name,
		user_login = excluded.user_login,
		followed_at = excluded.followed_at
		WHERE user_name IS NOT excluded.user_name
		OR user_login IS NOT excluded.user_login
		OR followed_at IS NOT excluded.followed_at;
	`)
	if err != nil {
		return fmt.Errorf("prepare error: %w", err)
	}
	defer stmt.Close()

	tx, err := d.db.Begin()
	if err != nil {
		return fmt.Errorf("begin transaction error: %w", err)
	}

	for _, follower := range followers {
		if _, err := tx.Stmt(stmt).Exec(follower.UserID, follower.UserName, follower.UserLogin, follower.FollowedAt); err != nil {
			tx.Rollback()
			return fmt.Errorf("exec error: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit error: %w", err)
	}

	return nil
}

func (d *Database) getFollowers() []Follower {
	rows, err := d.db.Query("SELECT user_id, user_name, user_login, followed_at FROM followers")
	if err != nil {
		log.Printf("Error querying followers: %v", err)
		return []Follower{}
	}
	defer rows.Close()

	var followers []Follower
	for rows.Next() {
		var f Follower
		if err := rows.Scan(&f.UserID, &f.UserName, &f.UserLogin, &f.FollowedAt); err != nil {
			log.Printf("Error scanning follower: %v", err)
			continue
		}
		followers = append(followers, f)
	}

	return followers
}

func (d *Database) getFollower(userID string) *Follower {
	row := d.db.QueryRow("SELECT user_id, user_name, user_login, followed_at FROM followers WHERE user_id = ?", userID)

	var f Follower
	if err := row.Scan(&f.UserID, &f.UserName, &f.UserLogin, &f.FollowedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil
		}
		log.Printf("Error querying follower: %v", err)
		return nil
	}

	return &f
}

func (d *Database) close() error {
	return d.db.Close()
}
