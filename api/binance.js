import 'dotenv/config';
import Binance from 'binance-api-node';

/* Authenticated client, can make signed calls */
export const client = Binance({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET,
});

/* Public REST Endpoints */

// Get the current exchange trading rules and symbol information.
export const exchangeInfo = client.exchangeInfo();
// Get the order book for a symbol.
export const book = (symbol, limit = 5) => client
  .book({ symbol, limit })
  .then(res => res)
  .catch(error => error);
// Retrieves Candlestick for a symbol. Candlesticks are uniquely identified by their open time.
export const candles = (symbol, interval = '1h', limit = 50) => client
  .candles({ symbol, interval, limit })
  .then(res => res)
  .catch(error => error);
// Get compressed, aggregate trades that filled at the time and price.
export const aggTrades = (symbol, limit = 10) => client
  .aggTrades({ symbol, limit })
  .then(res => res)
  .catch(error => error);
// Get recent trades of a symbol.
export const trades = (symbol, limit = 10) => client
  .trades({ symbol, limit })
  .then(res => res)
  .catch(error => error);
// 24 hour price change statistics, not providing a symbol will return all tickers.
export const dailyStats = symbol => client
  .dailyStats({ symbol })
  .then(res => res)
  .catch(error => error);
// Current average price for a symbol.
export const avgPrice = symbol => client
  .avgPrice({ symbol })
  .then(res => res)
  .catch(error => error);

/* Private REST Endpoints */

// Creates a limit order.
export const limitOrder = (side, quantity, symbol, price) => client
  .order({
    type: 'LIMIT',
    side,
    symbol,
    quantity,
    price,
  })
  .then(res => `LIMIT ${res.side} ORDER: ${res.origQty} ${res.symbol} at ${res.price}`)
  .catch(error => error);
// Creates a market order.
export const marketOrder = (side, quantity, symbol) => client
  .order({
    type: 'MARKET',
    side,
    symbol,
    quantity,
  })
  .then(res => `MARKET ${res.side} ORDER: ${res.origQty} ${res.symbol} at ${res.price}`)
  .catch(error => error);
// Check an order's status.
export const getOrder = (symbol, orderId) => client
  .getOrder({ symbol, orderId })
  .then(res => res)
  .catch(error => error);
// Cancels an active order.
export const cancelOrder = (symbol, orderId) => client
  .cancelOrder({ symbol, orderId })
  .then(res => res)
  .catch(error => error);
// Get trades for the current authenticated account and symbol.
export const myTrades = symbol => client
  .myTrades({ symbol })
  .then(res => res)
  .catch(error => error);
// Lookup symbol trades history.
export const tradeHistory = symbol => client
  .tradesHistory({ symbol })
  .then(res => res)
  .catch(error => error);
