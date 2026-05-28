package scheduler

import (
	"data-service/datasource"
	"log"
	"sync"
	"time"
)

// Task represents a scheduled task
type Task struct {
	Name     string
	Interval time.Duration
	Fn       func()
	ticker   *time.Ticker
	stopCh   chan struct{}
}

// Scheduler manages periodic tasks
type Scheduler struct {
	tasks   []*Task
	registry *datasource.Registry
	mu      sync.Mutex
	running bool
}

// NewScheduler creates a new scheduler
func NewScheduler(registry *datasource.Registry) *Scheduler {
	return &Scheduler{
		tasks:   make([]*Task, 0),
		registry: registry,
	}
}

// AddTask adds a new scheduled task
func (s *Scheduler) AddTask(name string, interval time.Duration, fn func()) {
	s.mu.Lock()
	defer s.mu.Unlock()

	task := &Task{
		Name:     name,
		Interval: interval,
		Fn:       fn,
		stopCh:   make(chan struct{}),
	}
	s.tasks = append(s.tasks, task)
	log.Printf("Scheduled task: %s (interval: %s)", name, interval)
}

// Start starts all scheduled tasks
func (s *Scheduler) Start() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return
	}

	s.running = true

	for _, task := range s.tasks {
		task.ticker = time.NewTicker(task.Interval)
		go func(t *Task) {
			log.Printf("Starting task: %s", t.Name)
			for {
				select {
				case <-t.ticker.C:
					func() {
						defer func() {
							if r := recover(); r != nil {
								log.Printf("Task %s panicked: %v", t.Name, r)
							}
						}()
						t.Fn()
					}()
				case <-t.stopCh:
					log.Printf("Stopping task: %s", t.Name)
					return
				}
			}
		}(task)
	}

	log.Printf("Scheduler started with %d tasks", len(s.tasks))
}

// Stop stops all scheduled tasks
func (s *Scheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running {
		return
	}

	for _, task := range s.tasks {
		if task.ticker != nil {
			task.ticker.Stop()
		}
		close(task.stopCh)
	}

	s.running = false
	log.Printf("Scheduler stopped")
}

// SetupDefaultTasks sets up the default scheduled tasks
func (s *Scheduler) SetupDefaultTasks() {
	// Pre-warm cache with popular symbols every 5 seconds during market hours
	s.AddTask("cache-warmup", 30*time.Second, func() {
		now := time.Now()
		// Only warm cache during A-share market hours (9:30-15:00 CST)
		hour, minute := now.Hour(), now.Minute()
		timeVal := hour*60 + minute
		if timeVal >= 570 && timeVal <= 900 { // 9:30 - 15:00
			popularSymbols := []string{"SH600519", "SZ000001", "SH601318", "SZ000858", "SH600036"}
			for _, sym := range popularSymbols {
				ctx := func() {} // simple no-op context
				_ = ctx
				// Fetch in background to warm cache
				go func(symbol string) {
					_, _ = s.registry.GetQuote(nil, symbol)
				}(sym)
			}
		}
	})

	// Clean up expired cache entries every minute
	s.AddTask("cache-cleanup", 1*time.Minute, func() {
		// Cache cleanup is handled by the registry's own cleanup goroutine
		log.Printf("Cache cleanup task running")
	})
}
