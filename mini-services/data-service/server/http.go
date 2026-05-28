package server

import (
	"data-service/datasource"
	"data-service/handler"
	"data-service/scheduler"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// HTTPServer represents the HTTP server
type HTTPServer struct {
	engine   *gin.Engine
	registry *datasource.Registry
	sched    *scheduler.Scheduler
	hub      *Hub
	port     int
	server   *http.Server
}

// NewHTTPServer creates a new HTTP server
func NewHTTPServer(registry *datasource.Registry, sched *scheduler.Scheduler, hub *Hub, port int) *HTTPServer {
	// Set Gin to release mode in production
	gin.SetMode(gin.ReleaseMode)

	engine := gin.New()
	engine.Use(gin.Logger())
	engine.Use(gin.Recovery())

	// CORS middleware
	engine.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	s := &HTTPServer{
		engine:   engine,
		registry: registry,
		sched:    sched,
		hub:      hub,
		port:     port,
	}

	s.setupRoutes()
	return s
}

// setupRoutes configures all HTTP routes
func (s *HTTPServer) setupRoutes() {
	// Create handlers
	marketHandler := handler.NewMarketHandler(s.registry)
	quoteHandler := handler.NewQuoteHandler(s.registry)
	klineHandler := handler.NewKlineHandler(s.registry)
	newsHandler := handler.NewNewsHandler(s.registry)

	// API routes
	api := s.engine.Group("/api")
	{
		api.GET("/health", marketHandler.HealthCheck)
		api.GET("/quote", quoteHandler.GetQuote)
		api.GET("/quotes", quoteHandler.GetQuotes)
		api.GET("/kline", klineHandler.GetKline)
		api.GET("/news", newsHandler.GetNews)
		api.GET("/sectors", marketHandler.GetSectors)
		api.GET("/indicators", klineHandler.GetIndicators)
		api.GET("/sentiment", marketHandler.GetSentiment)
		api.GET("/screen", marketHandler.ScreenStocks)
	}

	// WebSocket route
	s.engine.GET("/ws/quotes", func(c *gin.Context) {
		ServeWS(s.hub, c.Writer, c.Request)
	})
}

// Start starts the HTTP server
func (s *HTTPServer) Start() error {
	addr := fmt.Sprintf(":%d", s.port)

	s.server = &http.Server{
		Addr:         addr,
		Handler:      s.engine,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("Starting HTTP server on %s", addr)
	if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("server failed: %w", err)
	}

	return nil
}

// Stop gracefully stops the HTTP server
func (s *HTTPServer) Stop() error {
	if s.server != nil {
		log.Println("Shutting down HTTP server...")
		return s.server.Close()
	}
	return nil
}
