package datasource

import (
	"context"
	"data-service/model"
	"fmt"
	"log"
	"sync"
	"time"
)

// Registry manages data sources with fallback support
type Registry struct {
	sources []DataSource
	cache   map[string]*model.CacheItem
	mu      sync.RWMutex
}

// NewRegistry creates a new data source registry
func NewRegistry() *Registry {
	return &Registry{
		sources: make([]DataSource, 0),
		cache:   make(map[string]*model.CacheItem),
	}
}

// Register adds a data source to the registry
func (r *Registry) Register(source DataSource) {
	r.sources = append(r.sources, source)
	log.Printf("Registered data source: %s", source.Name())
}

// GetQuote fetches a quote with multi-source fallback
func (r *Registry) GetQuote(ctx context.Context, symbol string) (*model.Quote, error) {
	market := model.DetectMarket(symbol)

	// Check cache first
	cacheKey := fmt.Sprintf("quote:%s", symbol)
	if cached := r.getCache(cacheKey); cached != nil {
		if quote, ok := cached.(*model.Quote); ok {
			return quote, nil
		}
	}

	// Try each source that supports this market
	var lastErr error
	for _, source := range r.sources {
		if !source.SupportsMarket(market) {
			continue
		}

		quote, err := source.GetQuote(ctx, symbol)
		if err != nil {
			log.Printf("Source %s failed for %s: %v, trying next...", source.Name(), symbol, err)
			lastErr = err
			continue
		}

		// Cache the result with 5 second TTL for real-time data
		r.setCache(cacheKey, quote, 5*time.Second)
		return quote, nil
	}

	return nil, fmt.Errorf("all sources failed for symbol %s: %w", symbol, lastErr)
}

// GetQuotes fetches multiple quotes with fallback
func (r *Registry) GetQuotes(ctx context.Context, symbols []string) ([]*model.Quote, error) {
	quotes := make([]*model.Quote, 0, len(symbols))
	var mu sync.Mutex
	var wg sync.WaitGroup
	var firstErr error

	for _, symbol := range symbols {
		wg.Add(1)
		go func(s string) {
			defer wg.Done()
			quote, err := r.GetQuote(ctx, s)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				if firstErr == nil {
					firstErr = err
				}
				return
			}
			quotes = append(quotes, quote)
		}(symbol)
	}
	wg.Wait()

	if len(quotes) == 0 && firstErr != nil {
		return nil, firstErr
	}

	return quotes, nil
}

// GetKline fetches k-line data with fallback
func (r *Registry) GetKline(ctx context.Context, symbol string, period model.KlinePeriod, count int) ([]*model.Kline, error) {
	market := model.DetectMarket(symbol)

	// Check cache
	cacheKey := fmt.Sprintf("kline:%s:%s:%d", symbol, period, count)
	if cached := r.getCache(cacheKey); cached != nil {
		if klines, ok := cached.([]*model.Kline); ok {
			return klines, nil
		}
	}

	// Try each source
	var lastErr error
	for _, source := range r.sources {
		if !source.SupportsMarket(market) {
			continue
		}

		klines, err := source.GetKline(ctx, symbol, period, count)
		if err != nil {
			log.Printf("Source %s failed for kline %s: %v, trying next...", source.Name(), symbol, err)
			lastErr = err
			continue
		}

		// Cache with 1 hour TTL for historical data
		r.setCache(cacheKey, klines, 1*time.Hour)
		return klines, nil
	}

	return nil, fmt.Errorf("all sources failed for kline %s: %w", symbol, lastErr)
}

// GetNews fetches market news with fallback
func (r *Registry) GetNews(ctx context.Context, market model.Market, count int) ([]*model.News, error) {
	// Check cache
	cacheKey := fmt.Sprintf("news:%s:%d", market, count)
	if cached := r.getCache(cacheKey); cached != nil {
		if news, ok := cached.([]*model.News); ok {
			return news, nil
		}
	}

	// Try each source
	var lastErr error
	for _, source := range r.sources {
		if !source.SupportsMarket(market) {
			continue
		}

		news, err := source.GetNews(ctx, market, count)
		if err != nil {
			log.Printf("Source %s failed for news %s: %v, trying next...", source.Name(), market, err)
			lastErr = err
			continue
		}

		// Cache with 5 minute TTL for news
		r.setCache(cacheKey, news, 5*time.Minute)
		return news, nil
	}

	return nil, fmt.Errorf("all sources failed for news %s: %w", market, lastErr)
}

// GetSectors fetches sector rankings with fallback
func (r *Registry) GetSectors(ctx context.Context, market model.Market) ([]*model.Sector, error) {
	// Check cache
	cacheKey := fmt.Sprintf("sectors:%s", market)
	if cached := r.getCache(cacheKey); cached != nil {
		if sectors, ok := cached.([]*model.Sector); ok {
			return sectors, nil
		}
	}

	// Try each source
	var lastErr error
	for _, source := range r.sources {
		if !source.SupportsMarket(market) {
			continue
		}

		sectors, err := source.GetSectors(ctx, market)
		if err != nil {
			log.Printf("Source %s failed for sectors %s: %v", source.Name(), market, err)
			lastErr = err
			continue
		}

		// Cache with 1 minute TTL for sectors
		r.setCache(cacheKey, sectors, 1*time.Minute)
		return sectors, nil
	}

	return nil, fmt.Errorf("all sources failed for sectors %s: %w", market, lastErr)
}

// getCache retrieves an item from cache
func (r *Registry) getCache(key string) interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()

	item, exists := r.cache[key]
	if !exists || item.IsExpired() {
		return nil
	}
	return item.Data
}

// setCache stores an item in cache with TTL
func (r *Registry) setCache(key string, data interface{}, ttl time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.cache[key] = &model.CacheItem{
		Data:      data,
		ExpiresAt: time.Now().Add(ttl),
	}
}

// StartCleanup starts a goroutine to periodically clean expired cache entries
func (r *Registry) StartCleanup(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			r.mu.Lock()
			for k, v := range r.cache {
				if v.IsExpired() {
					delete(r.cache, k)
				}
			}
			r.mu.Unlock()
		}
	}()
}
