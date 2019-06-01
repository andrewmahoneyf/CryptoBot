import * as Binance from '../api/binance';
import * as CONST from './constants';

/*
  Allows for await in an async for each loop
*/
export async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await callback(array[index], index, array);
  }
}

/*
  Get price of symbol in pair value
*/
const getPrice = async (symbol, pair) => {
  const exchange = await Binance.avgPrice(symbol + pair);
  return parseFloat(exchange.price);
};

/*
  Convert symbol amount to pair value
*/
export const exchangeValue = async (amount, symbol, pair) => {
  if (symbol === CONST.STABLE_PAIR || (symbol === 'BTC' && pair !== CONST.STABLE_PAIR)) {
    return amount / (await getPrice(pair, symbol));
  }
  return (await getPrice(symbol, pair)) * amount;
};

/*
  Get symbol close candle values for given interval
*/
export const getCloses = async (symbol, interval, limit) => {
  const result = await Binance.candles(symbol, interval, limit);
  return result.map(candle => parseFloat(candle.close));
};

/*
  Get symbol open candle values for given interval
*/
export const getOpens = async (symbol, interval, limit) => {
  const result = await Binance.candles(symbol, interval, limit);
  return result.map(candle => parseFloat(candle.open));
};

/*
  Get symbol volume candle values for given interval
*/
export const getVolumes = async (symbol, interval, limit) => {
  const result = await Binance.candles(symbol, interval, limit);
  return result.map(candle => parseFloat(candle.volume));
};

/*
  Returns the value of an assets balance in BTC
*/
export const balanceToBTC = async (balance, asset) => (asset === 'BTC' ? balance : exchangeValue(balance, asset, 'BTC'));

/*
  returns an object with the parsed balance options along with a total
*/
export const parseBalances = (asset) => {
  const free = parseFloat(asset.free);
  const locked = parseFloat(asset.locked);
  const total = free + locked;
  return {
    free,
    locked,
    total,
  };
};

/*
  Returns float value of current balance for received symbol
*/
export const getBalance = async (symbol) => {
  const result = await Binance.client.accountInfo();
  const balance = result.balances.filter(coin => coin.asset === symbol)[0];
  const { free, total } = parseBalances(balance);
  return symbol === CONST.TRADE_PAIR ? free : total;
};

/*
  Returns the current value of your trade pair in USD
*/
export const getTradePairUSDValue = async () => {
  const stablePairs = ['USDT', 'PAX', 'TUSD', 'USDC', 'USDS'];
  const bal = await getBalance(CONST.TRADE_PAIR);
  return !stablePairs.includes(CONST.TRADE_PAIR)
    ? exchangeValue(bal, CONST.TRADE_PAIR, CONST.STABLE_PAIR)
    : bal;
};

/*
 Checks if current allocation is off from the set const value.
 Returns amount of difference in CONST.STABLE_PAIR value along with quantity of coin needed
 { USD: $500, AMOUNT: 2.576 }
*/
export const checkAllocation = async (coin, currentValue, budget) => {
  // check allocation % and calculate amount difference
  let allocation = budget.USD * CONST.ALLOCATION[coin];
  // if BNB, use highest number between MIN_BNB or allocation percentage
  if (coin === 'BNB' && CONST.HOLD_BNB) {
    allocation = Math.max(
      allocation,
      Math.ceil(await exchangeValue(CONST.MIN_BNB, 'BNB', CONST.STABLE_PAIR)),
    );
  }
  const diff = allocation - currentValue;
  return {
    USD: diff,
    QUANTITY: await exchangeValue(Math.abs(diff), CONST.STABLE_PAIR, coin),
  };
};

/*
  Checks fill quantity to verify if there is enough funds for an order
*/
export const checkFunds = async (quantity, coin) => {
  const pairBal = await getBalance(CONST.TRADE_PAIR);
  return (await exchangeValue(quantity, coin, CONST.TRADE_PAIR)) < pairBal;
};

/*
  Checks fill quantity to verify if there is enough funds for an order
*/
export const getSubHoldings = balances => balances.filter(
  balance => !CONST.ALLOCATION_KEYS.includes(balance.ASSET) && balance.ASSET !== CONST.TRADE_PAIR,
);

/*
  Returns info excahge info for the specific symbol
*/
const getTickerInfo = async (symbol) => {
  const info = await Binance.exchangeInfo;
  return info.symbols.filter(i => i.symbol === symbol)[0];
};

/*
  Returns defined filters set by binance for a symbol
*/
// eslint-disable-next-line max-len
const getTickerFilter = (info, filterType) => info.filters.filter(filter => filter.filterType === filterType)[0];

/*
  Formats the quantity to Binance standards
*/
const formatQuantity = (info, total) => {
  const lotFilter = getTickerFilter(info, 'LOT_SIZE');
  const stepSize = parseFloat(lotFilter.stepSize);
  const quantFloor = Math.floor(total / stepSize) * stepSize;
  return quantFloor.toFixed(CONST.DECIMALS[stepSize]);
};

/*
  Formats the price to Binance standards
*/
const formatPrice = (info, price) => {
  const priceFilter = getTickerFilter(info, 'PRICE_FILTER');
  const tickSize = parseFloat(priceFilter.tickSize);
  const priceFloor = Math.floor(price / tickSize) * tickSize;
  return priceFloor.toFixed(CONST.DECIMALS[tickSize]);
};

/*
  Checks books and trade history to determine limit price to set
*/
export const getLimit = async (info, side) => {
  const book = await Binance.book(info.symbol);
  const trades = await Binance.aggTrades(info.symbol);
  const avgTrade = trades.reduce((a, b) => a + parseFloat(b.price), 0) / trades.length;
  const bid = parseFloat(book.bids[0].price);
  const ask = parseFloat(book.asks[0].price);
  let price;
  if (side === 'BUY') {
    price = avgTrade < ask ? avgTrade : bid;
  } else {
    price = avgTrade > bid ? avgTrade : ask;
  }
  return formatPrice(info, price);
};

/*
  Finalize price and put in buy or sell orders
  Uses market orders for sells to make sure it triggers
*/
export const sendOrder = async (side, total, coin) => {
  const symbol = coin + CONST.TRADE_PAIR;
  const info = await getTickerInfo(symbol);
  console.log('ORDER:', side, total, symbol);
  if (process.env.NODE_ENV === 'production') {
    const price = await getLimit(info, side);
    console.log(`Limit set at $${price}`);
    const quantity = side === 'BUY'
      ? formatQuantity(info, total - (0.055 * total) / 100)
      : formatQuantity(info, total);
    await Binance.limitOrder(side, symbol, quantity, price);
  }
};
