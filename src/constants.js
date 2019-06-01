/* =======================================
  Fill in your desired portfolio allocation and substitute cryptocurrencies.
  Other variables such as time intervals or order minimums may be adjusted here as well.
  Please note that all coins need a pair with the STABLE and TRADE_PAIR currencies set below.
  ========================================
*/
// export const ALLOCATION = {
//   BTC: 0.25,
//   LTC: 0.15,
//   BNB: 0.1,
//   ETH: 0.1,
//   ADA: 0.05,
//   EOS: 0.05,
//   ONT: 0.05,
//   TRX: 0.05,
//   NANO: 0.05,
//   BCHABC: 0.05,
//   XLM: 0.05,
//   OMG: 0.05,
//   VET: 0.05,
// };

export const ALLOCATION = {
  LTC: 0.2,
  BNB: 0.15,
  VET: 0.1,
  ADA: 0.08,
  EOS: 0.08,
  XLM: 0.07,
  OMG: 0.07,
  NANO: 0.07,
  BCHABC: 0.06,
  ONT: 0.06,
  TRX: 0.06,
};

export const ALLOCATION_KEYS = Object.keys(ALLOCATION);

// Coins to be tested if you have remaining USD funds
export const SUBSTITUTES = ['ATOM', 'ENJ', 'BAT', 'BTT', 'QTUM', 'ICX', 'NEO', 'IOTA', 'THETA'];

// USDT, PAX, TUSD, USDC, USDS
export const STABLE_PAIR = 'USDT';
// Pair to use for all trades. Typically would be a stable coin, BTC, or BNB
export const TRADE_PAIR = 'USDT';

// Set to take advantage of lower trade fees. If true, BNB must be included in your allocation above
// VIP levels: 50, 200, 1000, 2000, 3500, 6000, 9000, 11000 https://www.binance.com/en/fee/schedule
export const HOLD_BNB = true;
export const MIN_BNB = 200;

/*
  ┌────────────── minute (Valid range: 0-59)
  | ┌──────────── hour (valid range: 0-23)
  | | ┌────────── day of the month (Valid range: 1-31)
  | | | ┌──────── month (Valid range: 1-12 or names of the months)
  | | | | ┌────── day of the week (valid range: 0-7 or names of the days)
  * * * * *
*/
// runs every 3 minutes in production
export const CRON_SCHEDULE = '*/3 * * * *';
// runs every 30 seconds in dev for testing
export const DEV_CRON_SCHEDULE = '*/30 * * * * *';

// Maximum percentage of total budget a subtitute can cover
export const MAX_SUBSTITUTE_PERCENTAGE = 0.05;

// Minimum value in USD to make a buy or sell order
export const USD_TRADE_MIN = 50;

// 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
export const CHART_INTERVALS = ['15m', '1h'];

export const MACD_INPUTS = {
  fastPeriod: 8,
  slowPeriod: 13,
  signalPeriod: 5,
  SimpleMAOscillator: false,
  SimpleMASignal: false,
};

export const RSI_INPUTS = {
  period: 14,
};

export const DECIMALS = {
  0.1: 1,
  0.01: 2,
  0.001: 3,
  0.0001: 4,
  0.00001: 5,
  0.000001: 6,
  0.0000001: 7,
  0.00000001: 8,
};
