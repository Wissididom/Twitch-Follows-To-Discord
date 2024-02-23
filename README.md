# Twitch Follows To Discord

This tool runs in the background and asks Twitch every 5 seconds for a new follower list and compares it to the version it got before. It then sends follows and unfollows to a Discord webhook depending on the configuration inside the `.env` file or specified as environment variables.

Follows could also be through `EventSub` but there is no event for Unfollows and that is the reason this tool exists.

## Prerequisites

* Node.js 18+
* Twitch Client ID (Can be created on https://dev.twitch.tv)
* Twitch Client Secret (Can be created on https://dev.twitch.tv)
* Discord Webhook URL (`Server Settings` -> `Integrations` -> `Webhooks` or `Channel Settings` -> `Integrations` -> `Webhooks`)

## Setup Tool

* Copy `example.env` to `.env` if you want to configure the tool in a file (you can skip this step if you want to use environment variables)
* Fill out the `.env` file or set environment variables with the keys you'll find in `example.env`
* Install dependencies using `npm i` or `npm install`
* Run `npm start`
