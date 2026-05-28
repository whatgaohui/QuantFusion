package indicator

// CalculateMACD computes the MACD indicator
// DIF = EMA12 - EMA26
// DEA = EMA9(DIF)
// MACD = 2 * (DIF - DEA)
func CalculateMACD(closes []float64) (dif, dea, macd []float64) {
	if len(closes) < 26 {
		// Not enough data for MACD
		dif = make([]float64, len(closes))
		dea = make([]float64, len(closes))
		macd = make([]float64, len(closes))
		return
	}

	ema12 := EMA(closes, 12)
	ema26 := EMA(closes, 26)

	// Calculate DIF
	dif = make([]float64, len(closes))
	for i := 0; i < len(closes); i++ {
		dif[i] = ema12[i] - ema26[i]
	}

	// Calculate DEA (EMA9 of DIF)
	// We need DIF values starting from index 25 (first valid EMA26)
	// Build a slice of valid DIF values for EMA calculation
	validDIF := make([]float64, len(closes))
	for i := 0; i < len(closes); i++ {
		validDIF[i] = dif[i]
	}
	dea = EMA(validDIF, 9)

	// Calculate MACD histogram
	macd = make([]float64, len(closes))
	for i := 0; i < len(closes); i++ {
		macd[i] = 2 * (dif[i] - dea[i])
	}

	return
}
