import * as CONST from './constants';
import * as indicators from './indicators';
import { getVolumes } from './helpers';

const recommender = async () => {
  const subs = await Promise.all(
    CONST.SUBSTITUTES.map(async (coin) => {
      const symbol = `${coin}${CONST.TRADE_PAIR}`;
      const volumes = await getVolumes(symbol, CONST.CHART_INTERVALS[0], 20);
      return {
        COIN: coin,
        MACD: await indicators.testMACD(symbol, false),
        RSI: await indicators.testRSI(symbol, false),
        VOLUME: volumes.reduce((a, b) => a + b, 0) / volumes.length,
      };
    }),
  );

  const bullishCoins = subs.filter(coin => coin.MACD && coin.RSI);
  return bullishCoins.sort((a, b) => b.VOLUME - a.VOLUME);
};

export default recommender;
