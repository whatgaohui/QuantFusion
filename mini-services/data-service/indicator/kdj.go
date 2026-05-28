package indicator

// CalculateKDJ computes the KDJ indicator
// RSV = (close - low9) / (high9 - low9) * 100
// K = 2/3 * prevK + 1/3 * RSV
// D = 2/3 * prevD + 1/3 * K
// J = 3 * K - 2 * D
func CalculateKDJ(highs, lows, closes []float64, n int) (k, d, j []float64) {
	if len(closes) == 0 || len(highs) != len(closes) || len(lows) != len(closes) {
		return nil, nil, nil
	}

	if n <= 0 {
		n = 9
	}

	length := len(closes)
	k = make([]float64, length)
	d = make([]float64, length)
	j = make([]float64, length)

	// Initial values
	prevK := 50.0
	prevD := 50.0

	for i := 0; i < length; i++ {
		if i < n-1 {
			// Not enough data for RSV
			k[i] = 50.0
			d[i] = 50.0
			j[i] = 50.0
			continue
		}

		// Find the highest high and lowest low in the period
		highestHigh := highs[i]
		lowestLow := lows[i]
		for m := i - n + 1; m <= i; m++ {
			if highs[m] > highestHigh {
				highestHigh = highs[m]
			}
			if lows[m] < lowestLow {
				lowestLow = lows[m]
			}
		}

		// Calculate RSV
		var rsv float64
		if highestHigh != lowestLow {
			rsv = (closes[i] - lowestLow) / (highestHigh - lowestLow) * 100
		} else {
			rsv = 50.0 // If range is 0, RSV is 50
		}

		// Calculate K
		k[i] = 2.0/3.0*prevK + 1.0/3.0*rsv

		// Calculate D
		d[i] = 2.0/3.0*prevD + 1.0/3.0*k[i]

		// Calculate J
		j[i] = 3.0*k[i] - 2.0*d[i]

		// Update previous values
		prevK = k[i]
		prevD = d[i]
	}

	return
}

// CalculateKDJDefault computes KDJ with default period (9)
func CalculateKDJDefault(highs, lows, closes []float64) (k, d, j []float64) {
	return CalculateKDJ(highs, lows, closes, 9)
}
