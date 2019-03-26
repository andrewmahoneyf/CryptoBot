import 'dotenv/config';
import moment from 'moment';

import Binance from 'binance-api-node';

// Authenticated client, can make signed calls
const client = Binance({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET
  //getTime: xxx // time generator function, optional, defaults to () => Date.now()
});

// Public REST Endpoints
export const ping = client.ping();
export const time = client
  .time()
  .then(time => console.log(moment(time).toString()));
export const exchangeInfo = client.exchangeInfo();
export const book = (symbol, limit = false) => client.book({ symbol, limit });
export const candles = (symbol, interval = '1h', limit = 25) =>
  client.candles({ symbol, interval, limit });
export const aggTrades = (symbol, limit = false) =>
  client.aggTrades({ symbol, limit });
export const trades = (symbol, limit = false) =>
  client.trades({ symbol, limit });
export const dailyStats = symbol => client.dailyStats({ symbol });
export const avgPrice = symbol => client.avgPrice({ symbol });
export const prices = client.prices();
export const allBookTickers = client.allBookTickers();

// Private REST Endpoints
export const order = (symbol, side, quantity, price) =>
  client.order({ symbol, side, quantity, price });
export const getOrder = (symbol, orderId) =>
  client.getOrder({ symbol, orderId });
export const cancelOrder = (symbol, orderId) =>
  client.cancelOrder({ symbol, orderId });
export const openOrders = symbol => client.openOrders({ symbol });
export const allOrders = symbol => client.allOrders({ symbol });
export const accountInfo = client.accountInfo();
export const myTrades = symbol => client.myTrades({ symbol });
export const tradeHistory = symbol => client.tradesHistory({ symbol });
export const depositHistory = client.depositHistory();
export const withdrawHistory = client.withdrawHistory();
export const withdraw = (asset, address, amount) =>
  client.withdraw({ asset, address, amount });
export const depositAddress = asset => client.depositAddress({ asset });
export const tradeFee = client.tradeFee();
