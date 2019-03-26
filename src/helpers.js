import * as client from '../api/binance';

/*
  Allows for await in an async for each loop
*/
export async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

/*
  Convert symbol to pair exchange value. Returns pair value
*/
export const exchangeValue = async (symbol, pair) => {
  const exchange = await client.avgPrice(symbol + pair);
  return parseFloat(exchange.price);
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
