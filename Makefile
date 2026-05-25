.PHONY: build run dev clean

build:
	go build -o twitch-follows-to-discord .

run: build
	./twitch-follows-to-discord

dev:
	go run .

clean:
	rm -f twitch-follows-to-discord
	go clean

deps:
	go mod download
	go mod tidy

fmt:
	go fmt ./...

vet:
	go vet ./...
