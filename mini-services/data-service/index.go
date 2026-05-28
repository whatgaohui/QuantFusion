package main

// index.go is the entry point for the data service.
// When run via `go run .`, this file calls into main.go.
// The main() function in main.go handles all setup and startup.

// Note: Since Go requires main() to be in package main, and we want
// `go run .` to work, both index.go and main.go are in the same package.
// The main() function lives in main.go - this file exists primarily
// as the designated entry point convention for bun integration.
