package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

var (
	includeFollows   bool
	includeUnfollows bool
)

func init() {
	// Load .env file if it exists
	_ = godotenv.Load()

	// Parse environment variables
	includeFollows = strings.ToLower(os.Getenv("INCLUDE_FOLLOWS")) == "true"
	includeUnfollows = strings.ToLower(os.Getenv("INCLUDE_UNFOLLOWS")) == "true"
}

func formatField(label, value string, link *string) string {
	if value == "" {
		return fmt.Sprintf("\n**%s**: ``(not available)``", label)
	}

	if link != nil && *link != "" {
		return fmt.Sprintf("\n**%s**: [%s](<{%s}>)", label, value, *link)
	}

	return fmt.Sprintf("\n**%s**: %s", label, value)
}

func buildContent(follower Follower, isFollow bool) (string, error) {
	var content string
	if isFollow {
		content = "**User Followed!**"
	} else {
		content = "**User Unfollowed!**"
	}

	twitchURL := fmt.Sprintf("https://www.twitch.tv/%s", follower.UserLogin)
	content += formatField("Display-Name", follower.UserName, &twitchURL)
	content += formatField("User-Name", follower.UserLogin, &twitchURL)
	content += formatField("User-ID", follower.UserID, &twitchURL)

	// Format followed_at
	if follower.FollowedAt != "" {
		followedTime, err := time.Parse(time.RFC3339, follower.FollowedAt)
		if err == nil {
			timestamp := followedTime.Unix()
			content += fmt.Sprintf("\n**Followed At**: <t:%d:F> (<t:%d:R>)", timestamp, timestamp)
		} else {
			content += "\n**Followed At**: ``(not available)``"
		}
	} else {
		content += "\n**Followed At**: ``(not available)``"
	}

	// Get user info
	user, err := getUser(follower.UserID, "id")
	if err == nil && user != nil {
		if createdAtVal, ok := user["created_at"].(string); ok && createdAtVal != "" {
			createdAt, err := time.Parse(time.RFC3339, createdAtVal)
			if err == nil {
				timestamp := createdAt.Unix()
				content += fmt.Sprintf("\n**Created At**: <t:%d:F> (<t:%d:R>)", timestamp, timestamp)
			} else {
				content += "\n**Created At**: ``(not available)``"
			}
		} else {
			content += "\n**Created At**: ``(not available)``"
		}
	} else {
		content += "\n**Created At**: ``(not available)``"
	}

	return content, nil
}

type DiscordMessage struct {
	Content         string      `json:"content"`
	AllowedMentions interface{} `json:"allowed_mentions"`
}

func postToDiscord(content string) error {
	webhookURL := os.Getenv("DISCORD_WEBHOOK_URL")
	if webhookURL == "" {
		return fmt.Errorf("DISCORD_WEBHOOK_URL not set")
	}

	webhookURL += "?wait=true"

	message := DiscordMessage{
		Content: content,
		AllowedMentions: map[string]interface{}{
			"parse": []string{},
		},
	}

	jsonBody, err := json.Marshal(message)
	if err != nil {
		return err
	}

	resp, err := http.Post(webhookURL, "application/json", bytes.NewReader(jsonBody))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	log.Printf("Sent request for content:\n%s\n", content)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("Received error response from Discord:\n%d %s\n%s\n", resp.StatusCode, resp.Status, string(body))
		return fmt.Errorf("discord error: %d %s", resp.StatusCode, resp.Status)
	}

	return nil
}

func syncFollowers(db *Database) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		broadcasterID := os.Getenv("BROADCASTER_ID")
		if broadcasterID == "" {
			log.Println("BROADCASTER_ID not set")
			continue
		}

		followers, err := getChannelFollowers(db, broadcasterID, "")
		if err != nil {
			log.Printf("Error getting followers: %v\n", err)
			continue
		}

		newFollowerList := followers.Data
		lastFollowerList := db.getFollowers()

		// Don't compare on first run
		if len(lastFollowerList) == 0 {
			if err := db.saveFollowerList(newFollowerList); err != nil {
				log.Printf("Error saving follower list: %v\n", err)
			}
			continue
		}

		// Find added followers
		lastFollowerSet := make(map[string]bool)
		for _, f := range lastFollowerList {
			lastFollowerSet[f.UserID] = true
		}

		var addedFollowers []Follower
		for _, f := range newFollowerList {
			if !lastFollowerSet[f.UserID] {
				addedFollowers = append(addedFollowers, f)
			}
		}

		log.Printf("added: %v\n", addedFollowers)

		// Find removed followers
		newFollowerSet := make(map[string]bool)
		for _, f := range newFollowerList {
			newFollowerSet[f.UserID] = true
		}

		var removedFollowers []Follower
		for _, f := range lastFollowerList {
			if !newFollowerSet[f.UserID] {
				removedFollowers = append(removedFollowers, f)
			}
		}

		log.Printf("removed: %v\n", removedFollowers)

		// Process added followers
		for _, follower := range addedFollowers {
			if err := db.saveFollower(follower.UserID, follower.UserName, follower.UserLogin, follower.FollowedAt); err != nil {
				log.Printf("Error saving follower: %v\n", err)
				continue
			}

			if includeFollows {
				content, err := buildContent(follower, true)
				if err != nil {
					log.Printf("Error building content: %v\n", err)
					continue
				}
				if err := postToDiscord(content); err != nil {
					log.Printf("Error posting to Discord: %v\n", err)
				}
			}
		}

		// Process removed followers
		for _, follower := range removedFollowers {
			if err := db.deleteFollower(follower.UserID); err != nil {
				log.Printf("Error deleting follower: %v\n", err)
				continue
			}

			if includeUnfollows {
				content, err := buildContent(follower, false)
				if err != nil {
					log.Printf("Error building content: %v\n", err)
					continue
				}
				if err := postToDiscord(content); err != nil {
					log.Printf("Error posting to Discord: %v\n", err)
				}
			}
		}
	}
}

func main() {
	// Verify environment variables
	if os.Getenv("TWITCH_CLIENT_ID") == "" || os.Getenv("TWITCH_CLIENT_SECRET") == "" {
		log.Fatal("TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET environment variables are required")
	}

	if os.Getenv("BROADCASTER_ID") == "" {
		log.Fatal("BROADCASTER_ID environment variable is required")
	}

	if os.Getenv("DISCORD_WEBHOOK_URL") == "" {
		log.Fatal("DISCORD_WEBHOOK_URL environment variable is required")
	}

	// Initialize database
	db := NewDatabase("./database/sqlite.db")
	defer db.close()

	// Verify Discord webhook
	webhookURL := os.Getenv("DISCORD_WEBHOOK_URL")
	resp, err := http.Get(webhookURL)
	if err != nil {
		log.Fatalf("Failed to verify Discord webhook: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Fatalf("Webhook response wasn't between 200 and 299 inclusive! (Status: %d - %s)", resp.StatusCode, resp.Status)
	}

	// Start the synchronization loop
	handleDCFLogin(db, func() {
		syncFollowers(db)
		// Keep the main function running
		select {}
	})
}
