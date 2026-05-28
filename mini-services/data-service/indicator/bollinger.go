package indicator

import "math"

// CalculateBollinger computes the Bollinger Bands
// Middle = SMA20
// Upper = Middle + 2 * stddev
// Lower = Middle - 2 * stddev
func CalculateBollinger(closes []float64, period int, mult float64) (upper, middle, lower []float64) {
	if len(closes) < period || period <= 0 {
		upper = make([]float64, len(closes))
		middle = make([]float64, len(closes))
		lower = make([]float64, len(closes))
		return
	}

	if mult <= 0 {
		mult = 2.0
	}

	// Default period is 20
	if period <= 0 {
		period = 20
	}

	middle = SMA(closes, period)
	stddevs := RollingStdDev(closes, period)

	upper = make([]float64, len(closes))
	lower = make([]float64, len(closes))

	for i := 0; i < len(closes); i++ {
		if i < period-1 || middle[i] == 0 {
			upper[i] = 0
			lower[i] = 0
			continue
		}
		band := mult * stddevs[i]
		upper[i] = middle[i] + band
		lower[i] = middle[i] - band

		// Handle NaN
		if math.IsNaN(upper[i]) || math.IsInf(upper[i], 0) {
			upper[i] = 0
		}
		if math.IsNaN(lower[i]) || math.IsInf(lower[i], 0) {
			lower[i] = 0
		}
	}

	return
}

// CalculateBollingerDefault computes Bollinger Bands with default parameters (20, 2)
func CalculateBollingerDefault(closes []float64) (upper, middle, lower []float64) {
	return CalculateBollinger(closes, 20, 2.0)
}

// BollingerBandwidth calculates the Bollinger Band Width
// Bandwidth = (Upper - Lower) / Middle * 100
func BollingerBandwidth(upper, middle, lower []float64) []float64 {
	if len(upper) != len(middle) || len(middle) != len(lower) {
		return nil
	}

	bw := make([]float64, len(upper))
	for i := 0; i < len(upper); i++ {
		if middle[i] == 0 {
			bw[i] = 0
			continue
		}
		bw[i] = (upper[i] - lower[i]) / middle[i] * 100
	}

	return bw
}

// BollingerPercentB calculates %B indicator
// %B = (Close - Lower) / (Upper - Lower)
func BollingerPercentB(closes, upper, lower []float64) []float64 {
	if len(closes) != len(upper) || len(upper) != len(lower) {
		return nil
	}

	pctB := make([]float64, len(closes))
	for i := 0; i < len(closes); i++ {
		band := upper[i] - lower[i]
		if band == 0 {
			pctB[i] = 0.5 // Middle of band
			continue
		}
		pctB[i] = (closes[i] - lower[i]) / band
	}

	return pctB
}
