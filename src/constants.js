export const STABLE_PAIRS = ['ETH', 'LTC', 'BTC'];

export const ALLOCATION = {
  ETH: 0.1,
  LTC: 0.15,
  BTC: 0.75
};

/*
export const LONGS = {
  LTC: 0.1,
  ETH: 0.1,
  ADA: 0.05,
  XLM: 0.05,
  TRX: 0.05,
  ONT: 0.05,
  EOS: 0.025,
  MIOTA: 0.025,
  NAS: 0.025,
  AION: 0.025
};
*/

export const TOTAL_ALTCOINS = 5;

// 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
export const USD_CHARTS = ['8h', '4h', '1h'];
export const BTC_CHARTS = ['2h', '1h', '30m'];

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
