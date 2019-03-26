import * as CONST from '../constants';
import { getCloses, asyncForEach } from '../helpers';

import { MACD } from 'technicalindicators';

/* 
  function to check for bear/bull crosses in MACD
  return bool true if positive histogram
*/
export const testMACD = async (symbol, pair) => {
  let allMACDsPass = true;
  symbol += pair;

  if ((pair = 'USDT')) {
    await asyncForEach(CONST.USD_CHARTS, async interval => {
      const current = await getMACD(symbol, interval);
      if (current.histogram < 0) {
        allMACDsPass = false;
      }
      console.log('MACD', symbol, interval, current.histogram);
    });
  } else {
    await asyncForEach(CONST.BTC_CHARTS, async interval => {
      const current = await getMACD(symbol, interval);
      if (current.histogram < 0) {
        allMACDsPass = false;
      }
      console.log('MACD', symbol, interval, current.histogram);
    });
  }

  return allMACDsPass;
};

/* 
  Helper function to get MACD
*/
const getMACD = async (symbol, interval) => {
  const closes = await getCloses(symbol, interval);
  const macdInput = {
    ...CONST.MACD_INPUTS,
    values: closes
  };
  return MACD.calculate(macdInput).pop();
};
