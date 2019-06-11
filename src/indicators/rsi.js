import ora from 'ora';
import chart_utils from 'chart_utils';
import * as CONST from '../constants';
import { getOHLC, asyncForEach } from '../helpers';

/*
  Helper function to get MACD
*/
const getRSI = async (symbol, interval) => {
  const ohlc = await getOHLC(symbol, interval);
  const { period } = CONST.RSI_INPUTS;
  return chart_utils.rsi(ohlc, period).pop();
};

/*
  function to check for overbought or oversold signals
  return bool true if it's not overbought for all time intervals
*/
export default async (symbol, log = true) => {
  let allRSIsPass = true;
  await asyncForEach(CONST.CHART_INTERVALS, async (interval) => {
    let spinner;
    if (log) {
      spinner = ora(`${symbol} RSI`).start();
    }
    const current = await getRSI(symbol, interval);
    const res = `${symbol} ${interval} RSI: ${current}`;
    if (current > 85) {
      allRSIsPass = false;
      if (spinner) spinner.fail(res);
    } else if (spinner) spinner.succeed(res);
  });
  return allRSIsPass;
};
