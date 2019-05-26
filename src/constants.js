/* =======================================
  Fill in you desired portfolio allocation below.
  Other variables such as time intervals or order
  minimums may be adjusted here as well. Please note 
  that all coins need both BTC & USDT pairs to trade.
  ========================================
*/
export const ALLOCATION = {
  BTC: 0.25,
  LTC: 0.15,
  BNB: 0.1,
  ETH: 0.1,
  ADA: 0.05,
  EOS: 0.05,
  ONT: 0.05,
  TRX: 0.05,
  NANO: 0.05,
  XLM: 0.05,
  OMG: 0.05,
  VET: 0.05
};

// Coins will be tested if you have remaining USD funds
export const SUBSTITUTES = [
  'ENJ',
  'BAT',
  'BTT',
  'QTUM',
  'ICX',
  'NEO',
  'IOTA',
  'BCHABC',
  'THETA'
  // 'NAS',
  // 'AION',
  // 'MFT',
  // 'WTC',
  // 'MCO',
  // 'NPXS'
];

// Maximum percentage of total budget a subtitute can cover
export const MAX_SUBSTITUTE_PERCENTAGE = 0.08;

// Minimum value in USD to make a buy or sell order
export const USD_TRADE_MIN = 50;

// 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
export const USD_CHART_INTERVALS = ['2h', '1h', '30m'];
export const BTC_CHART_INTERVALS = ['2h', '1h', '30m'];

export const MACD_INPUTS = {
  values: [],
  fastPeriod: 8,
  slowPeriod: 21,
  signalPeriod: 3,
  SimpleMAOscillator: false,
  SimpleMASignal: false
};

export const RSI = {
  length: 14,
  source: 'close'
};
