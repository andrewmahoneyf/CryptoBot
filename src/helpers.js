import * as client from '../api/binance';
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
  const exchange = await client.avgPrice(symbol + pair);
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
  const result = await client.candles(symbol, interval, limit);
  return result.map(candle => parseFloat(candle.close));
};

/*
  Get symbol open candle values for given interval
*/
export const getOpens = async (symbol, interval, limit) => {
  const result = await client.candles(symbol, interval, limit);
  return result.map(candle => parseFloat(candle.open));
};

/*
  Get symbol volume candle values for given interval
*/
export const getVolumes = async (symbol, interval, limit) => {
  const result = await client.candles(symbol, interval, limit);
  return result.map(candle => parseFloat(candle.volume));
};

/*
  Returns a formatted and filtered balance array
  [ { ASSET: 'ETH', BAL: 2.5 }, ... ]
*/
export const formatBalances = async () => {
  const result = await client.accountInfo;

  return result.balances
    .filter(coin => coin.free > 0)
    .map(coin => ({
      ASSET: coin.asset,
      BAL: parseFloat(coin.free),
    }));
};

/*
  Returns float value of current balance for received symbol
*/
export const getBalance = async (symbol) => {
  const balances = await formatBalances();
  const bal = balances.filter(coin => coin.ASSET === symbol).map(coin => coin.BAL)[0];
  // updating trade pairs balance to account for open orders
  if (symbol === CONST.TRADE_PAIR) {
    const openOrders = await client.openOrders();
    const ordersSum = openOrders.length > 0
      ? openOrders.reduce(
        // eslint-disable-next-line max-len
        (accumulator, currentOrder) => accumulator + parseFloat(currentOrder.price) * parseFloat(currentOrder.origQty),
        0,
      )
      : 0;
    return bal - ordersSum;
  }
  return bal;
};

/*
  Returns float value of current balance for received symbol
*/
// eslint-disable-next-line max-len
export const updateBalances = (balances, asset) => balances.filter(balance => balance.ASSET !== asset);

/*
  Returns float value of current available balance of the trade pair
*/
export const getTradePairBalance = async () => {
  const balances = await formatBalances();
  return balances.filter(coin => coin.ASSET === CONST.TRADE_PAIR).map(coin => coin.BAL)[0];
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
  const info = await client.exchangeInfo;
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
export const getLimit = async (info) => {
  const book = await client.book(info.symbol);
  const trades = await client.aggTrades(info.symbol);
  const avgTrade = trades.reduce((a, b) => a + parseFloat(b.price), 0) / trades.length;
  const bid = parseFloat(book.bids[0].price);
  const ask = parseFloat(book.asks[0].price);
  const price = avgTrade < ask ? avgTrade : bid;
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
    if (side === 'BUY') {
      const price = await getLimit(info);
      console.log(`Limit set at $${price}`);
      const quantity = formatQuantity(info, total - (0.055 * total) / 100);
      await client.limitOrder('LIMIT', side, symbol, quantity, price);
    } else {
      const quantity = formatQuantity(info, total);
      console.log('quantity', quantity);
      await client.marketSell('MARKET', side, symbol, quantity);
    }
  }
};
