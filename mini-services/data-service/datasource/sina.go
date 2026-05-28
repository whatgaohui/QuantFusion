package datasource

import (
	"context"
	"data-service/model"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// SinaDataSource implements DataSource for Sina Finance API
type SinaDataSource struct {
	BaseDataSource
	client *http.Client
}

// NewSinaDataSource creates a new Sina data source
func NewSinaDataSource() *SinaDataSource {
	return &SinaDataSource{
		BaseDataSource: NewBaseDataSource("sina", []model.Market{model.MarketASHare}),
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// GetQuote fetches a real-time quote from Sina Finance
func (s *SinaDataSource) GetQuote(ctx context.Context, symbol string) (*model.Quote, error) {
	market := model.DetectMarket(symbol)
	if !s.SupportsMarket(market) {
		return nil, fmt.Errorf("sina does not support market: %s", market)
	}

	// Convert symbol format: SH600519 -> sh600519
	sinaSymbol := strings.ToLower(model.FormatSinaSymbol(symbol))
	url := fmt.Sprintf("http://hq.sinajs.cn/list=%s", sinaSymbol)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Referer", "http://finance.sina.com.cn")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching quote from sina: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sina returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response body: %w", err)
	}

	return s.parseSinaQuote(symbol, string(body))
}

// GetQuotes fetches multiple real-time quotes from Sina Finance
func (s *SinaDataSource) GetQuotes(ctx context.Context, symbols []string) ([]*model.Quote, error) {
	// Filter to A-share symbols only
	aShareSymbols := make([]string, 0)
	for _, sym := range symbols {
		if model.DetectMarket(sym) == model.MarketASHare {
			aShareSymbols = append(aShareSymbols, sym)
		}
	}

	if len(aShareSymbols) == 0 {
		return []*model.Quote{}, nil
	}

	// Convert symbols
	sinaSymbols := make([]string, len(aShareSymbols))
	for i, sym := range aShareSymbols {
		sinaSymbols[i] = strings.ToLower(model.FormatSinaSymbol(sym))
	}

	url := fmt.Sprintf("http://hq.sinajs.cn/list=%s", strings.Join(sinaSymbols, ","))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Referer", "http://finance.sina.com.cn")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching quotes from sina: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response body: %w", err)
	}

	return s.parseSinaQuotes(aShareSymbols, string(body))
}

// GetKline fetches k-line data from Sina Finance
func (s *SinaDataSource) GetKline(ctx context.Context, symbol string, period model.KlinePeriod, count int) ([]*model.Kline, error) {
	market := model.DetectMarket(symbol)
	if !s.SupportsMarket(market) {
		return nil, fmt.Errorf("sina does not support market: %s", market)
	}

	sinaSymbol := strings.ToLower(model.FormatSinaSymbol(symbol))

	// Map period to Sina's kline period parameter
	var sinaPeriod string
	switch period {
	case model.Period5Min:
		sinaPeriod = "5"
	case model.Period15Min:
		sinaPeriod = "15"
	case model.Period30Min:
		sinaPeriod = "30"
	case model.Period60Min:
		sinaPeriod = "60"
	case model.PeriodDaily:
		sinaPeriod = "daily"
	case model.PeriodWeekly:
		sinaPeriod = "weekly"
	case model.PeriodMonthly:
		sinaPeriod = "monthly"
	default:
		sinaPeriod = "daily"
	}

	url := fmt.Sprintf("http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=%s&scale=%s&ma=no&datalen=%d",
		sinaSymbol, sinaPeriod, count)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating kline request: %w", err)
	}
	req.Header.Set("Referer", "http://finance.sina.com.cn")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching kline from sina: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading kline response: %w", err)
	}

	return s.parseSinaKline(symbol, string(body))
}

// GetNews fetches market news from Sina
func (s *SinaDataSource) GetNews(ctx context.Context, market model.Market, count int) ([]*model.News, error) {
	if !s.SupportsMarket(market) {
		return nil, fmt.Errorf("sina does not support market: %s", market)
	}

	// Return mock data for now - Sina news API requires different auth
	news := make([]*model.News, 0, count)
	for i := 0; i < count && i < 20; i++ {
		news = append(news, &model.News{
			Title:      fmt.Sprintf("A股市场动态 %d", i+1),
			Summary:    "市场行情分析及热点资讯",
			Source:     "新浪财经",
			URL:        fmt.Sprintf("http://finance.sina.com.cn/news/%d", i+1),
			Market:     model.MarketASHare,
			PublishedAt: time.Now().Add(-time.Duration(i) * time.Hour),
		})
	}
	return news, nil
}

// GetSectors fetches sector rankings from Sina
func (s *SinaDataSource) GetSectors(ctx context.Context, market model.Market) ([]*model.Sector, error) {
	if !s.SupportsMarket(market) {
		return nil, fmt.Errorf("sina does not support market: %s", market)
	}

	// Return mock sector data
	sectors := []*model.Sector{
		{Name: "白酒", Code: "BK0477", ChangePct: 2.35, Volume: 1500000, Amount: 8.5e9, TopStock: "贵州茅台", TopChange: 3.12},
		{Name: "新能源", Code: "BK0493", ChangePct: 1.87, Volume: 3200000, Amount: 12.3e9, TopStock: "宁德时代", TopChange: 4.56},
		{Name: "半导体", Code: "BK1036", ChangePct: -0.52, Volume: 2100000, Amount: 9.8e9, TopStock: "中芯国际", TopChange: 1.23},
		{Name: "医药", Code: "BK0729", ChangePct: 0.98, Volume: 1800000, Amount: 6.7e9, TopStock: "恒瑞医药", TopChange: 2.34},
		{Name: "银行", Code: "BK0475", ChangePct: -0.15, Volume: 900000, Amount: 4.2e9, TopStock: "招商银行", TopChange: 0.87},
	}
	return sectors, nil
}

// parseSinaQuote parses a single Sina quote response
func (s *SinaDataSource) parseSinaQuote(symbol string, body string) (*model.Quote, error) {
	// Response format: var hq_str_sh600519="贵州茅台,开盘价,昨收,当前价,...";
	lines := strings.Split(body, ";")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Extract the value part
		idx := strings.Index(line, "=")
		if idx < 0 {
			continue
		}

		valueStr := line[idx+1:]
		valueStr = strings.Trim(valueStr, "\" ")

		if valueStr == "" {
			continue
		}

		fields := strings.Split(valueStr, ",")
		if len(fields) < 32 {
			continue
		}

		open, _ := strconv.ParseFloat(fields[1], 64)
		prevClose, _ := strconv.ParseFloat(fields[2], 64)
		current, _ := strconv.ParseFloat(fields[3], 64)
		high, _ := strconv.ParseFloat(fields[4], 64)
		low, _ := strconv.ParseFloat(fields[5], 64)
		bid, _ := strconv.ParseFloat(fields[6], 64)
		ask, _ := strconv.ParseFloat(fields[7], 64)
		volume, _ := strconv.ParseInt(fields[8], 10, 64)
		amount, _ := strconv.ParseFloat(fields[9], 64)

		change := current - prevClose
		var changePct float64
		if prevClose > 0 {
			changePct = (change / prevClose) * 100
		}

		return &model.Quote{
			Symbol:     symbol,
			Name:       fields[0],
			Open:       open,
			PrevClose:  prevClose,
			Current:    current,
			High:       high,
			Low:        low,
			Bid:        bid,
			Ask:        ask,
			Volume:     volume,
			Amount:     amount,
			Change:     change,
			ChangePct:  changePct,
			Market:     model.DetectMarket(symbol),
			Timestamp:  time.Now(),
			DataSource: "sina",
		}, nil
	}

	return nil, fmt.Errorf("no valid quote data found in Sina response for %s", symbol)
}

// parseSinaQuotes parses multiple Sina quote responses
func (s *SinaDataSource) parseSinaQuotes(symbols []string, body string) ([]*model.Quote, error) {
	quotes := make([]*model.Quote, 0)
	lines := strings.Split(body, ";")

	for i, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || i >= len(symbols) {
			continue
		}

		idx := strings.Index(line, "=")
		if idx < 0 {
			continue
		}

		valueStr := line[idx+1:]
		valueStr = strings.Trim(valueStr, "\" ")

		if valueStr == "" {
			continue
		}

		fields := strings.Split(valueStr, ",")
		if len(fields) < 32 {
			continue
		}

		symbol := symbols[i]
		open, _ := strconv.ParseFloat(fields[1], 64)
		prevClose, _ := strconv.ParseFloat(fields[2], 64)
		current, _ := strconv.ParseFloat(fields[3], 64)
		high, _ := strconv.ParseFloat(fields[4], 64)
		low, _ := strconv.ParseFloat(fields[5], 64)
		bid, _ := strconv.ParseFloat(fields[6], 64)
		ask, _ := strconv.ParseFloat(fields[7], 64)
		volume, _ := strconv.ParseInt(fields[8], 10, 64)
		amount, _ := strconv.ParseFloat(fields[9], 64)

		change := current - prevClose
		var changePct float64
		if prevClose > 0 {
			changePct = (change / prevClose) * 100
		}

		quotes = append(quotes, &model.Quote{
			Symbol:     symbol,
			Name:       fields[0],
			Open:       open,
			PrevClose:  prevClose,
			Current:    current,
			High:       high,
			Low:        low,
			Bid:        bid,
			Ask:        ask,
			Volume:     volume,
			Amount:     amount,
			Change:     change,
			ChangePct:  changePct,
			Market:     model.DetectMarket(symbol),
			Timestamp:  time.Now(),
			DataSource: "sina",
		})
	}

	return quotes, nil
}

// parseSinaKline parses Sina k-line response
func (s *SinaDataSource) parseSinaKline(symbol string, body string) ([]*model.Kline, error) {
	// Sina returns JSON array like: [{"day":"2024-01-01","open":"100","high":"110","low":"95","close":"105","volume":"10000"}]
	body = strings.TrimSpace(body)
	if body == "" || body == "null" {
		return nil, fmt.Errorf("empty kline response from Sina")
	}

	// Simple JSON parsing - remove brackets and split
	body = strings.TrimPrefix(body, "[")
	body = strings.TrimSuffix(body, "]")

	if body == "" {
		return []*model.Kline{}, nil
	}

	klines := make([]*model.Kline, 0)
	// Split by }, { pattern
	entries := strings.Split(body, "},{")
	for i, entry := range entries {
		entry = strings.Trim(entry, "{}")
		if entry == "" {
			continue
		}

		fields := strings.Split(entry, ",")
		kline := &model.Kline{Symbol: symbol}

		for _, field := range fields {
			parts := strings.SplitN(field, ":", 2)
			if len(parts) != 2 {
				continue
			}
			key := strings.Trim(parts[0], "\"")
			val := strings.Trim(parts[1], "\"")

			switch key {
			case "day":
				kline.Timestamp, _ = time.Parse("2006-01-02", val)
			case "open":
				kline.Open, _ = strconv.ParseFloat(val, 64)
			case "high":
				kline.High, _ = strconv.ParseFloat(val, 64)
			case "low":
				kline.Low, _ = strconv.ParseFloat(val, 64)
			case "close":
				kline.Close, _ = strconv.ParseFloat(val, 64)
			case "volume":
				kline.Volume, _ = strconv.ParseInt(val, 10, 64)
			}
		}

		if i == 0 || kline.Close > 0 {
			klines = append(klines, kline)
		}
	}

	return klines, nil
}
