import * as client from '../api/binance';
import * as CONST from './constants';

/*
  Allows for await in an async for each loop
*/
export async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
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
  if (symbol === 'USDT' || (symbol === 'BTC' && pair !== 'USDT')) {
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
  Get symbol volume candle values for given interval
*/
export const formatBalances = async () => {
  const result = await client.accountInfo;

  return result.balances
    .filter(coin => coin.free > 0 || coin.locked > 0)
    .map(coin => ({
      ASSET: coin.asset,
      BAL: parseFloat(coin.free) + parseFloat(coin.locked)
    }));
};

/* 
  Returns float value of current balance for received symbol
*/
export const getBalance = async symbol => {
  const balances = await formatBalances();
  return balances
    .filter(coin => coin.ASSET === symbol)
    .map(coin => coin.BAL)[0];
};

/*
 Checks if current allocation is off from the set const.
 Returns amount of difference in USDT value along with quantity of coin needed 
 { USD: $500, AMOUNT: 2.576 }
*/
export const checkAllocation = async (coin, currentValue, budget) => {
  // Check allocation % and calculate amount difference
  const allocation = budget.USD * CONST.ALLOCATION[coin];
  const diff = allocation - currentValue;
  return {
    USD: diff,
    QUANTITY: await exchangeValue(Math.abs(diff), 'USDT', coin)
  };
};

/*
  Checks fill quantity to verify if there is enough funds for an order
*/
export const checkFunds = async (quantity, coin, pair) => {
  const pairBal = await getBalance(pair);
  return (await exchangeValue(quantity, coin, pair)) < pairBal;
};

/*
  Checks books and trade history to determine limit price to set
*/
export const getLimit = async (type, symbol) => {
  const book = await client.book(symbol);
  const trades = await client.aggTrades(symbol);
  const avgTrade =
    trades.reduce((a, b) => a + parseFloat(b.price), 0) / trades.length;
  const bid = parseFloat(book.bids[0].price);
  const ask = parseFloat(book.asks[0].price);
  if (type === 'BUY') return avgTrade < ask ? avgTrade : bid;
  else return avgTrade > bid ? avgTrade : ask;
};

/*
  Finalize price and put in buy or sell orders
  Uses market orders for sells to make sure it triggers
*/
export const sendOrder = async (side, quantity, symbol) => {
  console.log('ORDER:', side, quantity, symbol);
  if (side === 'BUY') {
    const price = await getLimit(type, symbol);
    console.log(`Limit set at $${price}`);
    await client.order('LIMIT', side, symbol, quantity, price);
  } else {
    await client.order('MARKET', side, symbol, quantity);
  }
};

/*
  Cancels all orders for a coin
*/
export const cancelOrders = async symbol => {
  const orders = await client.openOrders(symbol);
  console.log(`Canceling open orders: ${orders}`);
  await asyncForEach(orders, async order => {
    await client.cancelOrder(symbol, order.orderId);
  });
};
