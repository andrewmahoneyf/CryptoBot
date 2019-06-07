import ora from 'ora';
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
