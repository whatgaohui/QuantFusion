package datasource

import (
	"context"
	"data-service/model"
)

// DataSource defines the interface for all data sources
type DataSource interface {
	// Name returns the name of the data source
	Name() string

	// SupportsMarket returns whether this data source supports the given market
	SupportsMarket(market model.Market) bool

	// GetQuote fetches a real-time quote for a single symbol
	GetQuote(ctx context.Context, symbol string) (*model.Quote, error)

	// GetQuotes fetches real-time quotes for multiple symbols
	GetQuotes(ctx context.Context, symbols []string) ([]*model.Quote, error)

	// GetKline fetches k-line data for a symbol
	GetKline(ctx context.Context, symbol string, period model.KlinePeriod, count int) ([]*model.Kline, error)

	// GetNews fetches market news
	GetNews(ctx context.Context, market model.Market, count int) ([]*model.News, error)

	// GetSectors fetches sector rankings
	GetSectors(ctx context.Context, market model.Market) ([]*model.Sector, error)
}

// BaseDataSource provides common functionality for data sources
type BaseDataSource struct {
	name    string
	markets []model.Market
}

// NewBaseDataSource creates a new base data source
func NewBaseDataSource(name string, markets []model.Market) BaseDataSource {
	return BaseDataSource{name: name, markets: markets}
}

// Name returns the data source name
func (b *BaseDataSource) Name() string {
	return b.name
}

// SupportsMarket checks if the data source supports a given market
func (b *BaseDataSource) SupportsMarket(market model.Market) bool {
	for _, m := range b.markets {
		if m == market {
			return true
		}
	}
	return false
}
