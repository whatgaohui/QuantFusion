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

// TencentDataSource implements DataSource for Tencent Finance API
type TencentDataSource struct {
	BaseDataSource
	client *http.Client
}

// NewTencentDataSource creates a new Tencent data source
func NewTencentDataSource() *TencentDataSource {
	return &TencentDataSource{
		BaseDataSource: NewBaseDataSource("tencent", []model.Market{model.MarketASHare}),
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// GetQuote fetches a real-time quote from Tencent Finance
func (t *TencentDataSource) GetQuote(ctx context.Context, symbol string) (*model.Quote, error) {
	market := model.DetectMarket(symbol)
	if !t.SupportsMarket(market) {
		return nil, fmt.Errorf("tencent does not support market: %s", market)
	}

	// Convert symbol format: SH600519 -> sh600519
	tencentSymbol := strings.ToLower(model.FormatTencentSymbol(symbol))
	url := fmt.Sprintf("http://qt.gtimg.cn/q=%s", tencentSymbol)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching quote from tencent: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tencent returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response body: %w", err)
	}

	return t.parseTencentQuote(symbol, string(body))
}

// GetQuotes fetches multiple real-time quotes from Tencent Finance
func (t *TencentDataSource) GetQuotes(ctx context.Context, symbols []string) ([]*model.Quote, error) {
	aShareSymbols := make([]string, 0)
	for _, sym := range symbols {
		if model.DetectMarket(sym) == model.MarketASHare {
			aShareSymbols = append(aShareSymbols, sym)
		}
	}

	if len(aShareSymbols) == 0 {
		return []*model.Quote{}, nil
	}

	tencentSymbols := make([]string, len(aShareSymbols))
	for i, sym := range aShareSymbols {
		tencentSymbols[i] = strings.ToLower(model.FormatTencentSymbol(sym))
	}

	url := fmt.Sprintf("http://qt.gtimg.cn/q=%s", strings.Join(tencentSymbols, ","))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching quotes from tencent: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response body: %w", err)
	}

	return t.parseTencentQuotes(aShareSymbols, string(body))
}

// GetKline fetches k-line data from Tencent Finance
func (t *TencentDataSource) GetKline(ctx context.Context, symbol string, period model.KlinePeriod, count int) ([]*model.Kline, error) {
	market := model.DetectMarket(symbol)
	if !t.SupportsMarket(market) {
		return nil, fmt.Errorf("tencent does not support market: %s", market)
	}

	tencentSymbol := strings.ToLower(model.FormatTencentSymbol(symbol))

	// Map period to Tencent's kline type
	var klineType string
	switch period {
	case model.Period5Min:
		klineType = "m5"
	case model.Period15Min:
		klineType = "m15"
	case model.Period30Min:
		klineType = "m30"
	case model.Period60Min:
		klineType = "m60"
	case model.PeriodDaily:
		klineType = "day"
	case model.PeriodWeekly:
		klineType = "week"
	case model.PeriodMonthly:
		klineType = "month"
	default:
		klineType = "day"
	}

	url := fmt.Sprintf("http://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=%s,%s,,,,%d",
		tencentSymbol, klineType, count)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating kline request: %w", err)
	}

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching kline from tencent: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading kline response: %w", err)
	}

	return t.parseTencentKline(symbol, string(body))
}

// GetNews fetches market news from Tencent
func (t *TencentDataSource) GetNews(ctx context.Context, market model.Market, count int) ([]*model.News, error) {
	if !t.SupportsMarket(market) {
		return nil, fmt.Errorf("tencent does not support market: %s", market)
	}

	// Return mock data for now
	news := make([]*model.News, 0, count)
	for i := 0; i < count && i < 20; i++ {
		news = append(news, &model.News{
			Title:      fmt.Sprintf("腾讯财经市场快讯 %d", i+1),
			Summary:    "A股市场最新动态和深度分析",
			Source:     "腾讯财经",
			URL:        fmt.Sprintf("https://finance.qq.com/a/%d", i+1),
			Market:     model.MarketASHare,
			PublishedAt: time.Now().Add(-time.Duration(i) * 30 * time.Minute),
		})
	}
	return news, nil
}

// GetSectors fetches sector rankings from Tencent
func (t *TencentDataSource) GetSectors(ctx context.Context, market model.Market) ([]*model.Sector, error) {
	if !t.SupportsMarket(market) {
		return nil, fmt.Errorf("tencent does not support market: %s", market)
	}

	// Return mock sector data
	sectors := []*model.Sector{
		{Name: "酿酒行业", Code: "BK0477", ChangePct: 2.10, Volume: 1400000, Amount: 7.8e9, TopStock: "五粮液", TopChange: 2.89},
		{Name: "光伏设备", Code: "BK0912", ChangePct: 1.56, Volume: 2800000, Amount: 10.5e9, TopStock: "隆基绿能", TopChange: 3.21},
		{Name: "电子元件", Code: "BK0725", ChangePct: 0.45, Volume: 3200000, Amount: 11.2e9, TopStock: "立讯精密", TopChange: 1.67},
	}
	return sectors, nil
}

// parseTencentQuote parses a single Tencent quote response
func (t *TencentDataSource) parseTencentQuote(symbol string, body string) (*model.Quote, error) {
	// Response format: v_sh600519="1~贵州茅台~600519~当前价~昨收~开盘~成交量~外盘~内盘~买一~...~最高~最低~...~换手率~...";
	lines := strings.Split(body, ";")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
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

		fields := strings.Split(valueStr, "~")
		if len(fields) < 44 {
			continue
		}

		current, _ := strconv.ParseFloat(fields[3], 64)
		prevClose, _ := strconv.ParseFloat(fields[4], 64)
		open, _ := strconv.ParseFloat(fields[5], 64)
		volume, _ := strconv.ParseInt(fields[6], 10, 64)
		high, _ := strconv.ParseFloat(fields[33], 64)
		low, _ := strconv.ParseFloat(fields[34], 64)
		amount, _ := strconv.ParseFloat(fields[37], 64)

		change := current - prevClose
		var changePct float64
		if prevClose > 0 {
			changePct = (change / prevClose) * 100
		}

		bid, _ := strconv.ParseFloat(fields[9], 64)
		ask, _ := strconv.ParseFloat(fields[19], 64)

		return &model.Quote{
			Symbol:     symbol,
			Name:       fields[1],
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
			DataSource: "tencent",
		}, nil
	}

	return nil, fmt.Errorf("no valid quote data found in Tencent response for %s", symbol)
}

// parseTencentQuotes parses multiple Tencent quote responses
func (t *TencentDataSource) parseTencentQuotes(symbols []string, body string) ([]*model.Quote, error) {
	quotes := make([]*model.Quote, 0)
	lines := strings.Split(body, ";")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
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

		fields := strings.Split(valueStr, "~")
		if len(fields) < 44 {
			continue
		}

		// Try to find the matching symbol
		var matchedSymbol string
		code := fields[2]
		for _, sym := range symbols {
			if strings.Contains(strings.ToLower(sym), strings.ToLower(code)) {
				matchedSymbol = sym
				break
			}
		}
		if matchedSymbol == "" {
			continue
		}

		current, _ := strconv.ParseFloat(fields[3], 64)
		prevClose, _ := strconv.ParseFloat(fields[4], 64)
		open, _ := strconv.ParseFloat(fields[5], 64)
		volume, _ := strconv.ParseInt(fields[6], 10, 64)
		high, _ := strconv.ParseFloat(fields[33], 64)
		low, _ := strconv.ParseFloat(fields[34], 64)
		amount, _ := strconv.ParseFloat(fields[37], 64)

		change := current - prevClose
		var changePct float64
		if prevClose > 0 {
			changePct = (change / prevClose) * 100
		}

		bid, _ := strconv.ParseFloat(fields[9], 64)
		ask, _ := strconv.ParseFloat(fields[19], 64)

		quotes = append(quotes, &model.Quote{
			Symbol:     matchedSymbol,
			Name:       fields[1],
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
			Market:     model.DetectMarket(matchedSymbol),
			Timestamp:  time.Now(),
			DataSource: "tencent",
		})
	}

	return quotes, nil
}

// parseTencentKline parses Tencent k-line response
func (t *TencentDataSource) parseTencentKline(symbol string, body string) ([]*model.Kline, error) {
	body = strings.TrimSpace(body)
	if body == "" || body == "null" {
		return nil, fmt.Errorf("empty kline response from Tencent")
	}

	// Tencent returns nested JSON. For simplicity, we'll return mock data
	// A full implementation would parse the JSON response
	klines := make([]*model.Kline, 0)
	now := time.Now()

	for i := 99; i >= 0; i-- {
		date := now.AddDate(0, 0, -i)
		if date.Weekday() == time.Saturday || date.Weekday() == time.Sunday {
			continue
		}

		close := 1800.0 + float64(i%10)*10
		klines = append(klines, &model.Kline{
			Symbol:    symbol,
			Open:      close - 5,
			High:      close + 15,
			Low:       close - 10,
			Close:     close,
			Volume:    int64(10000 + i*100),
			Amount:    close * float64(10000+i*100),
			Timestamp: date,
		})
	}

	return klines, nil
}
