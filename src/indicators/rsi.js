import { RSI } from 'technicalindicators';
import * as CONST from '../constants';
import { getCloses, asyncForEach } from '../helpers';

/*
  Helper function to get MACD
*/
const getRSI = async (symbol, interval) => {
  const closes = await getCloses(symbol, interval);
  const rsiInput = {
    ...CONST.RSI_INPUTS,
    values: closes,
  };
  return RSI.calculate(rsiInput).pop();
};

/*
  function to check for overbought or oversold signals
  return bool true if it's not overbought for all time intervals
*/
export default async (symbol) => {
  let allRSIsPass = true;
  await asyncForEach(CONST.CHART_INTERVALS, async (interval) => {
    const current = await getRSI(symbol, interval);
    if (current > 85) {
      allRSIsPass = false;
    }
    console.log('RSI', symbol, interval, current);
  });
  return allRSIsPass;
};
