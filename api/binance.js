import 'dotenv/config';
import moment from 'moment';
import Binance from 'binance-api-node';

/* Authenticated client, can make signed calls */
export const client = Binance({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET,
});

/* Public REST Endpoints */

// Test connectivity to the API.
export const ping = client.ping();
// Test connectivity to the Rest API and get the current server time.
export const time = client.time().then(res => console.log(moment(res).toString()));
// Get the current exchange trading rules and symbol information.
export const exchangeInfo = client.exchangeInfo();
// Get the order book for a symbol.
export const book = (symbol, limit = 5) => client.book({ symbol, limit });
// Retrieves Candlestick for a symbol. Candlesticks are uniquely identified by their open time.
export const candles = (symbol, interval = '1h', limit = 25) => client.candles({ symbol, interval, limit });
// Get compressed, aggregate trades that filled at the time and price.
export const aggTrades = (symbol, limit = 20) => client.aggTrades({ symbol, limit });
// Get recent trades of a symbol.
export const trades = (symbol, limit = 20) => client.trades({ symbol, limit });
// 24 hour price change statistics, not providing a symbol will return all tickers.
export const dailyStats = symbol => client.dailyStats({ symbol });
// Current average price for a symbol.
export const avgPrice = symbol => client.avgPrice({ symbol });
// Latest price for all symbols.
export const prices = client.prices();
// Best price/qty on the order book for all symbols.
export const allBookTickers = client.allBookTickers();

/* Private REST Endpoints */

// Creates a new order.
export const limitOrder = (type, side, symbol, quantity, price) => client.order({
  type,
  side,
  symbol,
  quantity,
  price,
});
// Creates a market sell order.
export const marketSell = (type, side, symbol, quantity) => client.order({
  type,
  side,
  symbol,
  quantity,
});
// Check an order's status.
export const getOrder = (symbol, orderId) => client.getOrder({ symbol, orderId });
// Cancels an active order.
export const cancelOrder = (symbol, orderId) => client.cancelOrder({ symbol, orderId });
// Get all open orders.
export const openOrders = () => client.openOrders();
// Get all account orders on a symbol; active, canceled, or filled.
export const allOrders = symbol => client.allOrders({ symbol });
// Get current account information.
export const accountInfo = client.accountInfo();
// Get trades for the current authenticated account and symbol.
export const myTrades = symbol => client.myTrades({ symbol });
// Lookup symbol trades history.
export const tradeHistory = symbol => client.tradesHistory({ symbol });
