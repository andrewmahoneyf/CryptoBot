import ora from 'ora';
import chart_utils from 'chart_utils';
import * as CONST from '../constants';
import { getCloses, asyncForEach } from '../helpers';

/*
  Helper function to get MACD
*/
const getMACD = async (symbol, interval) => {
  const closes = await getCloses(symbol, interval);
  const { fastPeriod, slowPeriod, signalPeriod } = CONST.MACD_INPUTS;
  const [macd, signal] = chart_utils.macd(closes, fastPeriod, slowPeriod, signalPeriod).pop();
  return macd - signal;
};

/*
  function to check for bear/bull crosses in MACD
  return bool true if positive histogram for all time intervals
*/
export default async (symbol, log = true) => {
  let allMACDsPass = true;
  await asyncForEach(CONST.CHART_INTERVALS, async (interval) => {
    let spinner;
    if (log) {
      spinner = ora(`${symbol} MACD`).start();
    }
    const histogram = await getMACD(symbol, interval);
    const res = `${symbol} ${interval} MACD: ${histogram}`;
    if (histogram < 0) {
      allMACDsPass = false;
      if (spinner) spinner.fail(res);
    } else if (spinner) spinner.succeed(res);
  });
  return allMACDsPass;
};
