import ora from 'ora';
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
    const spinner = ora(`${symbol} MACD`).start();
    const macd = await getMACD(symbol, interval);
    const current = macd.pop();
    const res = `${symbol} ${interval} MACD: ${current.histogram}`;
    if (current.histogram < 0) {
      allMACDsPass = false;
      spinner.fail(res);
    } else {
      spinner.succeed(res);
    }
  });
  return allMACDsPass;
};
