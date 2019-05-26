import * as CONST from '../constants';
import { getCloses, asyncForEach } from '../helpers';

import { MACD } from 'technicalindicators';

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

/* 
  function to check for bear/bull crosses in MACD
  return bool true if positive histogram for all time intervals
*/
export const testMACD = async symbol => {
  let allMACDsPass = true;
  await asyncForEach(CONST.CHART_INTERVALS, async interval => {
    const current = await getMACD(symbol, interval);
    if (current.histogram < 0) {
      allMACDsPass = false;
    }
    console.log('MACD', symbol, interval, current.histogram);
  });
  return allMACDsPass;
};
