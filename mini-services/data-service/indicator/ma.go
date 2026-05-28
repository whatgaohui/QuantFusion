package indicator

import "math"

// SMA calculates the Simple Moving Average
// SMA = sum(close, n) / n
func SMA(closes []float64, period int) []float64 {
	if len(closes) < period || period <= 0 {
		return nil
	}

	result := make([]float64, len(closes))
	for i := 0; i < period-1; i++ {
		result[i] = 0
	}

	// Calculate initial sum
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += closes[i]
	}
	result[period-1] = sum / float64(period)

	// Calculate remaining values using rolling sum
	for i := period; i < len(closes); i++ {
		sum += closes[i] - closes[i-period]
		result[i] = sum / float64(period)
	}

	return result
}

// EMA calculates the Exponential Moving Average
// EMA = close * k + prev_ema * (1 - k), where k = 2/(n+1)
func EMA(closes []float64, period int) []float64 {
	if len(closes) < period || period <= 0 {
		return nil
	}

	result := make([]float64, len(closes))
	k := 2.0 / float64(period+1)

	// First EMA value is the SMA of the first period
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += closes[i]
		result[i] = 0
	}
	result[period-1] = sum / float64(period)

	// Calculate EMA for remaining values
	for i := period; i < len(closes); i++ {
		result[i] = closes[i]*k + result[i-1]*(1-k)
	}

	return result
}

// CalculateMA calculates multiple moving averages (MA5, MA10, MA20, MA60)
func CalculateMA(closes []float64) (ma5, ma10, ma20, ma60 []float64) {
	ma5 = SMA(closes, 5)
	ma10 = SMA(closes, 10)
	ma20 = SMA(closes, 20)
	ma60 = SMA(closes, 60)
	return
}

// StdDev calculates the standard deviation of a slice
func StdDev(data []float64) float64 {
	if len(data) == 0 {
		return 0
	}

	mean := 0.0
	for _, v := range data {
		mean += v
	}
	mean /= float64(len(data))

	variance := 0.0
	for _, v := range data {
		diff := v - mean
		variance += diff * diff
	}
	variance /= float64(len(data))

	return math.Sqrt(variance)
}

// RollingStdDev calculates rolling standard deviation
func RollingStdDev(data []float64, period int) []float64 {
	if len(data) < period || period <= 0 {
		return nil
	}

	result := make([]float64, len(data))
	for i := 0; i < period-1; i++ {
		result[i] = 0
	}

	for i := period - 1; i < len(data); i++ {
		window := data[i-period+1 : i+1]
		result[i] = StdDev(window)
	}

	return result
}
