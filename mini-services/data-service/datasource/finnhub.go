package datasource

import (
        "context"
        "data-service/model"
        "encoding/json"
        "fmt"
        "io"
        "net/http"
        "os"
        "strconv"
        "time"
)

// FinnhubDataSource implements DataSource for Finnhub API (US stocks)
type FinnhubDataSource struct {
        BaseDataSource
        client  *http.Client
        apiKey  string
}

// FinnhubQuoteResponse represents the Finnhub quote API response
type FinnhubQuoteResponse struct {
        CurrentPrice  float64 `json:"c"`
        Change        float64 `json:"d"`
        ChangePercent float64 `json:"dp"`
        High          float64 `json:"h"`
        Low           float64 `json:"l"`
        Open          float64 `json:"o"`
        PrevClose     float64 `json:"pc"`
        Timestamp     int64   `json:"t"`
}

// FinnhubNewsResponse represents the Finnhub news API response
type FinnhubNewsResponse struct {
        Category string `json:"category"`
        Datetime int64  `json:"datetime"`
        Headline string `json:"headline"`
        ID       int64  `json:"id"`
        Image    string `json:"image"`
        Related  string `json:"related"`
        Source   string `json:"source"`
        Summary  string `json:"summary"`
        URL      string `json:"url"`
}

// FinnhubCandleResponse represents the Finnhub candle API response
type FinnhubCandleResponse struct {
        Open      []float64 `json:"o"`
        High      []float64 `json:"h"`
        Low       []float64 `json:"l"`
        Close     []float64 `json:"c"`
        Volume    []int64   `json:"v"`
        Timestamp []int64   `json:"t"`
        Status    string    `json:"s"`
}

// NewFinnhubDataSource creates a new Finnhub data source
func NewFinnhubDataSource() *FinnhubDataSource {
        apiKey := os.Getenv("FINNHUB_API_KEY")
        return &FinnhubDataSource{
                BaseDataSource: NewBaseDataSource("finnhub", []model.Market{model.MarketUS}),
                client: &http.Client{
                        Timeout: 5 * time.Second, // Moderate timeout for external API
                },
                apiKey: apiKey,
        }
}

// GetQuote fetches a real-time quote from Finnhub
func (f *FinnhubDataSource) GetQuote(ctx context.Context, symbol string) (*model.Quote, error) {
        market := model.DetectMarket(symbol)
        if !f.SupportsMarket(market) {
                return nil, fmt.Errorf("finnhub does not support market: %s", market)
        }

        if f.apiKey == "" {
                return nil, fmt.Errorf("FINNHUB_API_KEY not set")
        }

        url := fmt.Sprintf("https://finnhub.io/api/v1/quote?symbol=%s&token=%s", symbol, f.apiKey)

        req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
        if err != nil {
                return nil, fmt.Errorf("creating request: %w", err)
        }

        resp, err := f.client.Do(req)
        if err != nil {
                return nil, fmt.Errorf("fetching quote from finnhub: %w", err)
        }
        defer resp.Body.Close()

        if resp.StatusCode != http.StatusOK {
                return nil, fmt.Errorf("finnhub returned status %d", resp.StatusCode)
        }

        body, err := io.ReadAll(resp.Body)
        if err != nil {
                return nil, fmt.Errorf("reading response body: %w", err)
        }

        var quoteResp FinnhubQuoteResponse
        if err := json.Unmarshal(body, &quoteResp); err != nil {
                return nil, fmt.Errorf("parsing finnhub quote: %w", err)
        }

        return &model.Quote{
                Symbol:     symbol,
                Name:       symbol, // Finnhub doesn't return name in quote endpoint
                Open:       quoteResp.Open,
                PrevClose:  quoteResp.PrevClose,
                Current:    quoteResp.CurrentPrice,
                High:       quoteResp.High,
                Low:        quoteResp.Low,
                Bid:        0, // Not available from Finnhub
                Ask:        0, // Not available from Finnhub
                Volume:     0, // Not available from quote endpoint
                Amount:     0,
                Change:     quoteResp.Change,
                ChangePct:  quoteResp.ChangePercent,
                Market:     model.MarketUS,
                Timestamp:  time.Now(),
                DataSource: "finnhub",
        }, nil
}

// GetQuotes fetches multiple real-time quotes from Finnhub
func (f *FinnhubDataSource) GetQuotes(ctx context.Context, symbols []string) ([]*model.Quote, error) {
        quotes := make([]*model.Quote, 0, len(symbols))

        for _, symbol := range symbols {
                if model.DetectMarket(symbol) != model.MarketUS {
                        continue
                }
                quote, err := f.GetQuote(ctx, symbol)
                if err != nil {
                        continue
                }
                quotes = append(quotes, quote)
        }

        return quotes, nil
}

// GetKline fetches k-line data from Finnhub
func (f *FinnhubDataSource) GetKline(ctx context.Context, symbol string, period model.KlinePeriod, count int) ([]*model.Kline, error) {
        market := model.DetectMarket(symbol)
        if !f.SupportsMarket(market) {
                return nil, fmt.Errorf("finnhub does not support market: %s", market)
        }

        if f.apiKey == "" {
                return nil, fmt.Errorf("FINNHUB_API_KEY not set")
        }

        // Map period to Finnhub resolution
        var resolution string
        switch period {
        case model.Period1Min:
                resolution = "1"
        case model.Period5Min:
                resolution = "5"
        case model.Period15Min:
                resolution = "15"
        case model.Period30Min:
                resolution = "30"
        case model.Period60Min:
                resolution = "60"
        case model.PeriodDaily:
                resolution = "D"
        case model.PeriodWeekly:
                resolution = "W"
        case model.PeriodMonthly:
                resolution = "M"
        default:
                resolution = "D"
        }

        // Calculate time range
        to := time.Now().Unix()
        from := time.Now().AddDate(0, -6, 0).Unix() // 6 months back

        url := fmt.Sprintf("https://finnhub.io/api/v1/stock/candle?symbol=%s&resolution=%s&from=%d&to=%d&token=%s",
                symbol, resolution, from, to, f.apiKey)

        req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
        if err != nil {
                return nil, fmt.Errorf("creating kline request: %w", err)
        }

        resp, err := f.client.Do(req)
        if err != nil {
                return nil, fmt.Errorf("fetching kline from finnhub: %w", err)
        }
        defer resp.Body.Close()

        body, err := io.ReadAll(resp.Body)
        if err != nil {
                return nil, fmt.Errorf("reading kline response: %w", err)
        }

        var candleResp FinnhubCandleResponse
        if err := json.Unmarshal(body, &candleResp); err != nil {
                return nil, fmt.Errorf("parsing finnhub candle: %w", err)
        }

        if candleResp.Status != "ok" || len(candleResp.Close) == 0 {
                return nil, fmt.Errorf("no kline data from finnhub for %s", symbol)
        }

        // Build klines from response
        klines := make([]*model.Kline, 0)
        length := len(candleResp.Close)
        startIdx := 0
        if length > count {
                startIdx = length - count
        }

        for i := startIdx; i < length; i++ {
                klines = append(klines, &model.Kline{
                        Symbol:    symbol,
                        Open:      candleResp.Open[i],
                        High:      candleResp.High[i],
                        Low:       candleResp.Low[i],
                        Close:     candleResp.Close[i],
                        Volume:    candleResp.Volume[i],
                        Amount:    candleResp.Close[i] * float64(candleResp.Volume[i]),
                        Timestamp: time.Unix(candleResp.Timestamp[i], 0),
                })
        }

        return klines, nil
}

// GetNews fetches US market news from Finnhub
func (f *FinnhubDataSource) GetNews(ctx context.Context, market model.Market, count int) ([]*model.News, error) {
        if !f.SupportsMarket(market) {
                return nil, fmt.Errorf("finnhub does not support market: %s", market)
        }

        if f.apiKey == "" {
                return nil, fmt.Errorf("FINNHUB_API_KEY not set")
        }

        // Get general market news
        from := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
        to := time.Now().Format("2006-01-02")

        url := fmt.Sprintf("https://finnhub.io/api/v1/company-news?symbol=AAPL&from=%s&to=%s&token=%s",
                from, to, f.apiKey)

        req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
        if err != nil {
                return nil, fmt.Errorf("creating news request: %w", err)
        }

        resp, err := f.client.Do(req)
        if err != nil {
                return nil, fmt.Errorf("fetching news from finnhub: %w", err)
        }
        defer resp.Body.Close()

        body, err := io.ReadAll(resp.Body)
        if err != nil {
                return nil, fmt.Errorf("reading news response: %w", err)
        }

        var newsResp []FinnhubNewsResponse
        if err := json.Unmarshal(body, &newsResp); err != nil {
                return nil, fmt.Errorf("parsing finnhub news: %w", err)
        }

        news := make([]*model.News, 0, count)
        for i, item := range newsResp {
                if i >= count {
                        break
                }
                news = append(news, &model.News{
                        Title:       item.Headline,
                        Summary:     item.Summary,
                        Source:      item.Source,
                        URL:         item.URL,
                        Symbol:      item.Related,
                        Market:      model.MarketUS,
                        PublishedAt: time.Unix(item.Datetime, 0),
                })
        }

        return news, nil
}

// GetSectors is not supported by Finnhub free tier
func (f *FinnhubDataSource) GetSectors(ctx context.Context, market model.Market) ([]*model.Sector, error) {
        // Finnhub free tier doesn't provide sector data
        // Return mock data for US market
        sectors := []*model.Sector{
                {Name: "Technology", Code: "TECH", ChangePct: 1.25, Volume: 50000000, Amount: 150e9, TopStock: "AAPL", TopChange: 1.45},
                {Name: "Healthcare", Code: "HC", ChangePct: 0.87, Volume: 30000000, Amount: 80e9, TopStock: "JNJ", TopChange: 0.95},
                {Name: "Finance", Code: "FIN", ChangePct: -0.32, Volume: 40000000, Amount: 120e9, TopStock: "JPM", TopChange: -0.15},
                {Name: "Energy", Code: "ENR", ChangePct: 2.15, Volume: 25000000, Amount: 60e9, TopStock: "XOM", TopChange: 3.01},
        }
        return sectors, nil
}

// GetCompanyProfile fetches company profile from Finnhub
func (f *FinnhubDataSource) GetCompanyProfile(ctx context.Context, symbol string) (map[string]interface{}, error) {
        if f.apiKey == "" {
                return nil, fmt.Errorf("FINNHUB_API_KEY not set")
        }

        url := fmt.Sprintf("https://finnhub.io/api/v1/stock/profile2?symbol=%s&token=%s", symbol, f.apiKey)

        req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
        if err != nil {
                return nil, fmt.Errorf("creating profile request: %w", err)
        }

        resp, err := f.client.Do(req)
        if err != nil {
                return nil, fmt.Errorf("fetching profile from finnhub: %w", err)
        }
        defer resp.Body.Close()

        body, err := io.ReadAll(resp.Body)
        if err != nil {
                return nil, fmt.Errorf("reading profile response: %w", err)
        }

        var profile map[string]interface{}
        if err := json.Unmarshal(body, &profile); err != nil {
                return nil, fmt.Errorf("parsing finnhub profile: %w", err)
        }

        return profile, nil
}

// parseFinnhubSymbol extracts the US ticker from a symbol
func parseFinnhubSymbol(symbol string) string {
        // For US stocks, the symbol is just the ticker (e.g., AAPL)
        // No prefix conversion needed
        return symbol
}

// parseFloat safely parses a float string
func parseFloat(s string) float64 {
        v, _ := strconv.ParseFloat(s, 64)
        return v
}
