package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	validateEndpoint = "https://id.twitch.tv/oauth2/validate"
	scopes           = "moderator:read:followers"
)

type TokenData struct {
	AccessToken     string `json:"access_token,omitempty"`
	RefreshToken    string `json:"refresh_token,omitempty"`
	DeviceCode      string `json:"device_code,omitempty"`
	UserCode        string `json:"user_code,omitempty"`
	VerificationURI string `json:"verification_uri,omitempty"`
	ExpiresIn       int    `json:"expires_in,omitempty"`
	Interval        int    `json:"interval,omitempty"`
}

type TwitchAPI struct {
	tokens TokenData
}

var twitchAPI = &TwitchAPI{}

func (t *TwitchAPI) fetchTwitchAPI(url string, method string, body interface{}) (map[string]interface{}, error) {
	headers := map[string]string{
		"Client-ID":     os.Getenv("TWITCH_CLIENT_ID"),
		"Authorization": fmt.Sprintf("Bearer %s", t.tokens.AccessToken),
		"Content-Type":  "application/json",
	}

	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	if !strings.HasPrefix(fmt.Sprintf("%d", resp.StatusCode), "2") {
		errorMsg := fmt.Sprintf("%d %s", resp.StatusCode, resp.Status)
		if msg, ok := result["message"].(string); ok {
			errorMsg = fmt.Sprintf("%d %s", resp.StatusCode, msg)
		}
		return nil, fmt.Errorf("%s", errorMsg)
	}

	return result, nil
}

func handleDCFLogin(db *Database, loopCallback func()) {
	broadcasterID := os.Getenv("BROADCASTER_ID")

	if db.isTokenSet(broadcasterID) {
		if validate(db) {
			log.Println("Validated Tokens. Starting loop...")
			loopCallback()
			return
		}
	}

	clientID := os.Getenv("TWITCH_CLIENT_ID")
	dcfURL := fmt.Sprintf("https://id.twitch.tv/oauth2/device?client_id=%s&scopes=%s", clientID, url.QueryEscape(scopes))

	resp, err := http.Post(dcfURL, "application/json", nil)
	if err != nil || !strings.HasPrefix(fmt.Sprintf("%d", resp.StatusCode), "2") {
		log.Fatal("Failed to retrieve device code")
	}

	var dcfJSON TokenData
	if err := json.NewDecoder(resp.Body).Decode(&dcfJSON); err != nil {
		log.Fatal("Failed to decode device code response")
	}
	resp.Body.Close()

	twitchAPI.tokens.DeviceCode = dcfJSON.DeviceCode
	twitchAPI.tokens.UserCode = dcfJSON.UserCode
	twitchAPI.tokens.VerificationURI = dcfJSON.VerificationURI

	log.Printf("Open %s in a browser and enter %s!\n", dcfJSON.VerificationURI, dcfJSON.UserCode)

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		tokenURL := fmt.Sprintf(
			"https://id.twitch.tv/oauth2/token?client_id=%s&scopes=%s&device_code=%s&grant_type=urn:ietf:params:oauth:grant-type:device_code",
			clientID, url.QueryEscape(scopes), dcfJSON.DeviceCode,
		)

		tokenResp, err := http.Post(tokenURL, "application/json", nil)
		if err != nil {
			continue
		}

		if tokenResp.StatusCode == 400 {
			tokenResp.Body.Close()
			continue
		}

		var tokenJSON TokenData
		if err := json.NewDecoder(tokenResp.Body).Decode(&tokenJSON); err != nil {
			tokenResp.Body.Close()
			continue
		}
		tokenResp.Body.Close()

		twitchAPI.tokens = tokenJSON
		if err := db.setToken(broadcasterID, tokenJSON.AccessToken, tokenJSON.RefreshToken); err != nil {
			log.Printf("Failed to save tokens: %v", err)
			continue
		}

		log.Println("Device Code Flow Tokens obtained. Starting loop...")
		loopCallback()
		return
	}
}

func getUser(identifier string, idType string) (map[string]interface{}, error) {
	if identifier == "" {
		return twitchAPI.fetchTwitchAPI("https://api.twitch.tv/helix/users", "GET", nil)
	}

	apiURL := fmt.Sprintf("https://api.twitch.tv/helix/users?%s=%s", idType, identifier)
	result, err := twitchAPI.fetchTwitchAPI(apiURL, "GET", nil)
	if err != nil {
		return nil, err
	}

	if data, ok := result["data"].([]interface{}); ok && len(data) > 0 {
		return data[0].(map[string]interface{}), nil
	}

	return nil, fmt.Errorf("no user data returned")
}

type FollowersResponse struct {
	Data       []Follower             `json:"data"`
	Pagination map[string]interface{} `json:"pagination"`
	Total      int                    `json:"total"`
}

func getChannelFollowers(db *Database, broadcasterID string, paginationCursor string) (*FollowersResponse, error) {
	apiURL := fmt.Sprintf("https://api.twitch.tv/helix/channels/followers?broadcaster_id=%s&first=100", broadcasterID)
	if paginationCursor != "" {
		apiURL += fmt.Sprintf("&after=%s", paginationCursor)
	}

	result, err := twitchAPI.fetchTwitchAPI(apiURL, "GET", nil)
	if err != nil {
		// Check if it's a 401 error
		if strings.Contains(err.Error(), "401") {
			log.Println("Token expired. Refreshing...")
			if !refresh(db) {
				return nil, fmt.Errorf("token refresh failed")
			}
			return getChannelFollowers(db, broadcasterID, paginationCursor)
		}
		return nil, err
	}

	response := &FollowersResponse{}

	// Parse followers
	if data, ok := result["data"].([]interface{}); ok {
		for _, item := range data {
			if followerMap, ok := item.(map[string]interface{}); ok {
				f := Follower{
					UserID:     fmt.Sprintf("%v", followerMap["user_id"]),
					UserName:   fmt.Sprintf("%v", followerMap["user_name"]),
					UserLogin:  fmt.Sprintf("%v", followerMap["user_login"]),
					FollowedAt: fmt.Sprintf("%v", followerMap["followed_at"]),
				}
				response.Data = append(response.Data, f)
			}
		}
	}

	// Parse pagination
	if pagination, ok := result["pagination"].(map[string]interface{}); ok {
		response.Pagination = pagination
	}

	// Parse total
	if total, ok := result["total"].(float64); ok {
		response.Total = int(total)
	}

	// Handle pagination recursively
	if cursor, ok := response.Pagination["cursor"].(string); ok && cursor != "" {
		nextResponse, err := getChannelFollowers(db, broadcasterID, cursor)
		if err != nil {
			return nil, err
		}
		response.Data = append(response.Data, nextResponse.Data...)
	}

	return response, nil
}

func refresh(db *Database) bool {
	log.Println("Refreshing tokens...")

	broadcasterID := os.Getenv("BROADCASTER_ID")
	tokenData := db.getToken(broadcasterID)
	if tokenData == nil {
		log.Println("No tokens found")
		return false
	}

	refreshToken, ok := tokenData["refresh_token"].(string)
	if !ok {
		log.Println("Invalid refresh token")
		return false
	}

	clientID := os.Getenv("TWITCH_CLIENT_ID")
	clientSecret := os.Getenv("TWITCH_CLIENT_SECRET")

	tokenURL := fmt.Sprintf(
		"https://id.twitch.tv/oauth2/token?grant_type=refresh_token&refresh_token=%s&client_id=%s&client_secret=%s",
		url.QueryEscape(refreshToken),
		clientID,
		clientSecret,
	)

	// Manually create a request without Authorization header
	req, err := http.NewRequest("POST", tokenURL, nil)
	if err != nil {
		log.Printf("Token refresh failed: %v", err)
		return false
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Token refresh failed: %v", err)
		return false
	}
	defer resp.Body.Close()

	if !strings.HasPrefix(fmt.Sprintf("%d", resp.StatusCode), "2") {
		log.Printf("Token refresh failed with status: %d", resp.StatusCode)
		return false
	}

	var tokenJSON TokenData
	if err := json.NewDecoder(resp.Body).Decode(&tokenJSON); err != nil {
		log.Printf("Token refresh failed: %v", err)
		return false
	}

	twitchAPI.tokens = tokenJSON
	if err := db.setToken(broadcasterID, tokenJSON.AccessToken, tokenJSON.RefreshToken); err != nil {
		log.Printf("Failed to save tokens: %v", err)
		return false
	}

	log.Println("Tokens refreshed successfully!")
	return true
}

func validate(db *Database) bool {
	broadcasterID := os.Getenv("BROADCASTER_ID")
	tokenData := db.getToken(broadcasterID)
	if tokenData == nil {
		return false
	}

	// Set tokens for API calls
	twitchAPI.tokens.AccessToken = fmt.Sprintf("%v", tokenData["access_token"])
	twitchAPI.tokens.RefreshToken = fmt.Sprintf("%v", tokenData["refresh_token"])

	_, err := twitchAPI.fetchTwitchAPI(validateEndpoint, "GET", nil)
	if err != nil {
		if strings.Contains(err.Error(), "401") {
			return refresh(db)
		}
		return false
	}

	log.Println("Tokens validated successfully!")
	return true
}
