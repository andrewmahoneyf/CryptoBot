/* =======================================
  Fill in your desired portfolio allocation and substitute cryptocurrencies.
  Other variables such as time intervals or order minimums may be adjusted here as well.
  Please note that all coins need a pair with the STABLE and TRADE_PAIR currencies set below.
  ========================================
*/

export const ALLOCATION = {
  LTC: 0.3,
  BTC: 0.2,
  ETH: 0.1,
  BNB: 0.1,
  ADA: 0.1,
  EOS: 0.1,
  VET: 0.05,
  ONE: 0.05,
};

export const ALLOCATION_KEYS = Object.keys(ALLOCATION);

// Coins to be tested if you have remaining allocation or USD funds
export const TRADE_SUBS = true;
export const SUBSTITUTES = ['XLM', 'XRP', 'OMG', 'TRX', 'ONT', 'QTUM', 'ICX', 'NEO', 'IOTA'];
// Maximum percentage of total budget a subtitute can cover
export const MAX_SUBSTITUTE_PERCENTAGE = 0.05;

// USDT, PAX, TUSD, USDC, USDS
export const STABLE_PAIR = 'USDT';
// Pair to use for all trades. Typically would be a stable coin, BTC, or BNB
export const TRADE_PAIR = 'USDT';

// Set to take advantage of lower trade fees. If true, BNB must be included in your allocation above
// VIP levels: 50, 200, 1000, 2000, 3500, 6000, 9000, 11000 https://www.binance.com/en/fee/schedule
export const HOLD_BNB = true;
export const MIN_BNB = 50;

// The current trade free you pay on Binance. Used to calculate max buy order
export const TRADE_FEE = 0.0675;

// Set to true if you wish to gradually sell profits to maintain the allocation percentages
export const TAKE_PROFITS = true;

// Amount of order hidden in public trade book if allowed for trade pair
export const ICEBERG_QTY = 0.8;

/*
  ┌────────────── minute (Valid range: 0-59)
  | ┌──────────── hour (valid range: 0-23)
  | | ┌────────── day of the month (Valid range: 1-31)
  | | | ┌──────── month (Valid range: 1-12 or names of the months)
  | | | | ┌────── day of the week (valid range: 0-7 or names of the days)
  * * * * *
*/
// runs every 10 minutes in production
export const CRON_SCHEDULE = '*/10 * * * *';
// runs every 30 seconds in dev for testing
export const DEV_CRON_SCHEDULE = '*/30 * * * * *';

// Minimum value in USD to make a buy or sell order
export const USD_TRADE_MIN = 100;

// 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
export const CHART_INTERVALS = ['1h'];

export const MACD_INPUTS = {
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9,
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
