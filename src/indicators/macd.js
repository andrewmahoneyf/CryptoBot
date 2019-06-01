import { MACD } from 'technicalindicators';
import * as CONST from '../constants';
import { getCloses, asyncForEach } from '../helpers';

/*
  Helper function to get MACD
*/
const getMACD = async (symbol, interval) => {
  const closes = await getCloses(symbol, interval);
  const macdInput = {
    ...CONST.MACD_INPUTS,
    values: closes,
  };
  return MACD.calculate(macdInput);
};

/*
  function to check for bear/bull crosses in MACD
  return bool true if positive histogram for all time intervals
*/
export default async (symbol) => {
  let allMACDsPass = true;
  await asyncForEach(CONST.CHART_INTERVALS, async (interval) => {
    const macd = await getMACD(symbol, interval);
    const current = macd.pop();
    if (['1m', '3m', '5m', '15m'].includes(interval)) {
      const recent = macd.slice(macd.length - 2);
      allMACDsPass = !recent.every(m => m.histogram < 0);
    } else if (current.histogram < 0) {
      allMACDsPass = false;
    }
    console.log('MACD', symbol, interval, current.histogram);
  });
  return allMACDsPass;
};
