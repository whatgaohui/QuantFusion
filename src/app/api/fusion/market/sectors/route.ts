import { NextRequest, NextResponse } from 'next/server';

// Finnhub free tier doesn't provide sector/industry performance data
// So we return static mock data with some randomization

interface SectorData {
  name: string;
  change: number;
  changePercent: number;
  volume: string;
  marketCap: string;
  topStocks: { symbol: string; name: string; change: number }[];
}

function generateSectorData(market: string): SectorData[] {
  const rand = (min: number, max: number) => Number((min + Math.random() * (max - min)).toFixed(2));
  const randInt = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));

  if (market === 'A') {
    return [
      {
        name: 'Technology',
        change: rand(-50, 120),
        changePercent: rand(-2.5, 3.5),
        volume: '12.5B',
        marketCap: '8.2T',
        topStocks: [
          { symbol: '300750', name: 'CATL', change: rand(-3, 5) },
          { symbol: '002415', name: 'Hikvision', change: rand(-2, 3) },
          { symbol: '000725', name: 'BOE Tech', change: rand(-2, 4) },
        ],
      },
      {
        name: 'Finance',
        change: rand(-30, 80),
        changePercent: rand(-1.5, 2.0),
        volume: '8.3B',
        marketCap: '5.6T',
        topStocks: [
          { symbol: '601398', name: 'ICBC', change: rand(-1, 2) },
          { symbol: '600036', name: 'CMB', change: rand(-1, 2) },
          { symbol: '601318', name: 'Ping An', change: rand(-2, 3) },
        ],
      },
      {
        name: 'Healthcare',
        change: rand(-20, 60),
        changePercent: rand(-1.8, 2.5),
        volume: '4.2B',
        marketCap: '3.1T',
        topStocks: [
          { symbol: '600276', name: 'Jiangsu Hengrui', change: rand(-2, 3) },
          { symbol: '000538', name: 'Yunnan Baiyao', change: rand(-1, 2) },
          { symbol: '300760', name: 'Mindray', change: rand(-2, 4) },
        ],
      },
      {
        name: 'Consumer',
        change: rand(-25, 70),
        changePercent: rand(-2.0, 2.8),
        volume: '6.8B',
        marketCap: '4.5T',
        topStocks: [
          { symbol: '600519', name: 'Moutai', change: rand(-1, 2) },
          { symbol: '000858', name: 'Wuliangye', change: rand(-2, 3) },
          { symbol: '601888', name: 'China Tourism', change: rand(-3, 4) },
        ],
      },
      {
        name: 'Energy',
        change: rand(-40, 90),
        changePercent: rand(-2.2, 2.5),
        volume: '5.5B',
        marketCap: '3.8T',
        topStocks: [
          { symbol: '601857', name: 'PetroChina', change: rand(-2, 3) },
          { symbol: '600028', name: 'Sinopec', change: rand(-1, 2) },
          { symbol: '601088', name: 'China Shenhua', change: rand(-2, 3) },
        ],
      },
      {
        name: 'Industrials',
        change: rand(-35, 80),
        changePercent: rand(-1.8, 2.2),
        volume: '4.0B',
        marketCap: '2.9T',
        topStocks: [
          { symbol: '600031', name: 'Sany Heavy', change: rand(-2, 3) },
          { symbol: '601766', name: 'CRRC', change: rand(-1, 2) },
          { symbol: '002049', name: 'Unigroup Guoxin', change: rand(-3, 4) },
        ],
      },
    ];
  }

  // US market sectors (default)
  return [
    {
      name: 'Technology',
      change: rand(-80, 200),
      changePercent: rand(-2.5, 3.5),
      volume: '45.2B',
      marketCap: '14.8T',
      topStocks: [
        { symbol: 'AAPL', name: 'Apple', change: rand(-2, 3) },
        { symbol: 'NVDA', name: 'NVIDIA', change: rand(-3, 5) },
        { symbol: 'MSFT', name: 'Microsoft', change: rand(-2, 3) },
      ],
    },
    {
      name: 'Healthcare',
      change: rand(-40, 100),
      changePercent: rand(-1.5, 2.0),
      volume: '18.6B',
      marketCap: '7.2T',
      topStocks: [
        { symbol: 'UNH', name: 'UnitedHealth', change: rand(-1, 2) },
        { symbol: 'JNJ', name: 'Johnson & Johnson', change: rand(-1, 2) },
        { symbol: 'PFE', name: 'Pfizer', change: rand(-2, 3) },
      ],
    },
    {
      name: 'Finance',
      change: rand(-50, 120),
      changePercent: rand(-1.8, 2.5),
      volume: '32.1B',
      marketCap: '9.5T',
      topStocks: [
        { symbol: 'JPM', name: 'JPMorgan', change: rand(-1, 2) },
        { symbol: 'BAC', name: 'Bank of America', change: rand(-1, 2) },
        { symbol: 'GS', name: 'Goldman Sachs', change: rand(-2, 3) },
      ],
    },
    {
      name: 'Consumer Discretionary',
      change: rand(-60, 150),
      changePercent: rand(-2.0, 2.8),
      volume: '22.4B',
      marketCap: '6.8T',
      topStocks: [
        { symbol: 'AMZN', name: 'Amazon', change: rand(-2, 3) },
        { symbol: 'TSLA', name: 'Tesla', change: rand(-4, 5) },
        { symbol: 'HD', name: 'Home Depot', change: rand(-1, 2) },
      ],
    },
    {
      name: 'Energy',
      change: rand(-70, 130),
      changePercent: rand(-2.2, 2.5),
      volume: '15.8B',
      marketCap: '4.2T',
      topStocks: [
        { symbol: 'XOM', name: 'ExxonMobil', change: rand(-2, 3) },
        { symbol: 'CVX', name: 'Chevron', change: rand(-1, 2) },
        { symbol: 'COP', name: 'ConocoPhillips', change: rand(-2, 3) },
      ],
    },
    {
      name: 'Industrials',
      change: rand(-45, 110),
      changePercent: rand(-1.8, 2.2),
      volume: '12.3B',
      marketCap: '5.1T',
      topStocks: [
        { symbol: 'CAT', name: 'Caterpillar', change: rand(-2, 3) },
        { symbol: 'BA', name: 'Boeing', change: rand(-3, 4) },
        { symbol: 'GE', name: 'GE Aerospace', change: rand(-2, 3) },
      ],
    },
    {
      name: 'Communication Services',
      change: rand(-55, 140),
      changePercent: rand(-2.0, 3.0),
      volume: '20.5B',
      marketCap: '6.0T',
      topStocks: [
        { symbol: 'GOOGL', name: 'Alphabet', change: rand(-2, 3) },
        { symbol: 'META', name: 'Meta', change: rand(-3, 4) },
        { symbol: 'DIS', name: 'Disney', change: rand(-2, 3) },
      ],
    },
    {
      name: 'Utilities',
      change: rand(-20, 50),
      changePercent: rand(-0.8, 1.2),
      volume: '5.2B',
      marketCap: '1.8T',
      topStocks: [
        { symbol: 'NEE', name: 'NextEra', change: rand(-1, 1) },
        { symbol: 'DUK', name: 'Duke Energy', change: rand(-1, 1) },
        { symbol: 'SO', name: 'Southern Co', change: rand(-1, 1) },
      ],
    },
  ];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market') || 'US';

    const sectors = generateSectorData(market);

    return NextResponse.json(sectors);
  } catch (error) {
    console.error('[fusion/sectors] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sector data' },
      { status: 500 }
    );
  }
}
