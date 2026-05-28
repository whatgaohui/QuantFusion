package main

import (
	"data-service/datasource"
	"data-service/scheduler"
	"data-service/server"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	port := flag.Int("port", 8080, "HTTP server port")
	flag.Parse()

	log.Println("=== QuantFusion Data Service ===")
	log.Printf("Starting on port %d...", *port)

	// Create data source registry
	registry := datasource.NewRegistry()

	// Register data sources with priority order (first = highest priority)
	sinaDS := datasource.NewSinaDataSource()
	tencentDS := datasource.NewTencentDataSource()
	finnhubDS := datasource.NewFinnhubDataSource()

	registry.Register(sinaDS)
	registry.Register(tencentDS)
	registry.Register(finnhubDS)

	// Start cache cleanup
	registry.StartCleanup(5 * time.Minute)

	// Create WebSocket hub
	hub := server.NewHub()
	go hub.Run()

	// Create scheduler
	sched := scheduler.NewScheduler(registry)
	sched.SetupDefaultTasks()
	sched.Start()

	// Create and start HTTP server
	httpServer := server.NewHTTPServer(registry, sched, hub, *port)

	// Handle graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := httpServer.Start(); err != nil {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	sig := <-sigCh
	log.Printf("Received signal: %v", sig)

	// Cleanup
	sched.Stop()
	if err := httpServer.Stop(); err != nil {
		log.Printf("Error stopping server: %v", err)
	}

	log.Println("Data service stopped")
}
