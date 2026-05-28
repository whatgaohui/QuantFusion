package indicator

// CalculateRSI computes the Relative Strength Index
// RSI = 100 - 100/(1 + avg_gain/avg_loss)
// Uses Wilder's smoothing method
func CalculateRSI(closes []float64, periods ...int) map[int][]float64 {
	if len(closes) < 2 {
		return nil
	}

	// Default periods: 6, 12, 14
	defaultPeriods := []int{6, 12, 14}
	if len(periods) > 0 {
		defaultPeriods = periods
	}

	results := make(map[int][]float64)

	for _, period := range defaultPeriods {
		results[period] = calculateRSI(closes, period)
	}

	return results
}

// calculateRSI computes RSI for a single period using Wilder's smoothing
func calculateRSI(closes []float64, period int) []float64 {
	if len(closes) < period+1 {
		rsi := make([]float64, len(closes))
		return rsi
	}

	rsi := make([]float64, len(closes))

	// Calculate price changes
	changes := make([]float64, len(closes)-1)
	for i := 1; i < len(closes); i++ {
		changes[i-1] = closes[i] - closes[i-1]
	}

	// Calculate initial average gain and loss
	var avgGain, avgLoss float64
	for i := 0; i < period; i++ {
		if changes[i] > 0 {
			avgGain += changes[i]
		} else {
			avgLoss += -changes[i]
		}
	}
	avgGain /= float64(period)
	avgLoss /= float64(period)

	// Calculate first RSI
	if avgLoss == 0 {
		rsi[period] = 100
	} else {
		rs := avgGain / avgLoss
		rsi[period] = 100 - 100/(1+rs)
	}

	// Calculate remaining RSI values using Wilder's smoothing
	for i := period + 1; i < len(closes); i++ {
		change := changes[i-1]
		if change > 0 {
			avgGain = (avgGain*float64(period-1) + change) / float64(period)
			avgLoss = (avgLoss * float64(period-1)) / float64(period)
		} else {
			avgGain = (avgGain * float64(period-1)) / float64(period)
			avgLoss = (avgLoss*float64(period-1) - change) / float64(period)
		}

		if avgLoss == 0 {
			rsi[i] = 100
		} else {
			rs := avgGain / avgLoss
			rsi[i] = 100 - 100/(1+rs)
		}
	}

	return rsi
}

// CalculateRSI6 calculates RSI with period 6
func CalculateRSI6(closes []float64) []float64 {
	return calculateRSI(closes, 6)
}

// CalculateRSI12 calculates RSI with period 12
func CalculateRSI12(closes []float64) []float64 {
	return calculateRSI(closes, 12)
}

// CalculateRSI14 calculates RSI with period 14
func CalculateRSI14(closes []float64) []float64 {
	return calculateRSI(closes, 14)
}
