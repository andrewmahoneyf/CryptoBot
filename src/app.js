import moment from 'moment';
import ora from 'ora';
import * as Binance from '../api/binance';
import * as indicators from './indicators';
import * as CONST from './constants';
import scheduleJob from './job';
import recommender from './recommender';
import {
  asyncForEach,
  exchangeValue,
  balanceToBTC,
  parseBalances,
  cancelOrders,
  sendOrder,
  getBalance,
  checkAllocation,
  checkFunds,
  getTradePairUSDValue,
  getSubHoldings,
  verifySymbolPairs,
} from './helpers';

/*
  ==============   Main app method  ================
  Checks API, gets balances, calculates total budget,
  cancels outstanding orders, orders minimum BNB if set,
  swing trades your main allocation, and then fills
  remaining budget with substitutes if bullish
*/
scheduleJob(async () => {
  // 1. test connectivity to the API then log server time
  await Binance.client.ping();
  await Binance.client.time().then((res) => {
    console.log(`
    ================================
    ${moment(res).format('LLLL')} 
    ================================`);
  });
  // 2. cancel any outstanding orders
  await cancelOrders();
  // 3. spend any stable currency if using BTC as trade pair
  if (CONST.TRADE_PAIR === 'BTC') {
    await spendStableHoldings();
  }
  // 4. verify current funds
  const balances = await getBalances();
  console.log('Balances:');
  console.table(balances);
  const budget = await getBudget(balances);
  console.log('Budget:');
  console.table(budget);

  if (budget.USD > CONST.USD_TRADE_MIN) {
    // 5. check if substitute positions should be sold
    await checkOnSubs(balances);
    // 6. check BNB balance if min holding set
    if (CONST.HOLD_BNB) await fillMinBNB();
    // 7. trade main allocations
    await tradeMainAllocations(budget);
    // 8. trade substitute coins if BTC is bullish
    if (CONST.TRADE_SUBS) await tradeSubs(budget);
  } else {
    ora().warn('Need more funds in your account');
  }
});

/*
  Returns an array of all current portfolio balances with
  a minimum value of over $10 and provides their value in BTC
  [ { ASSET: 'ETH', BAL: 2.5, FREE: 2, BTC: .005 }, ... ]
*/
const getBalances = async () => {
  const accountInfo = await Binance.client.accountInfo();

  const formatedBalances = await Promise.all(
    accountInfo.balances
      .filter(coin => coin.free > 0 || coin.locked > 0)
      .map(async (coin) => {
        const { free, total } = parseBalances(coin);
        const hasPairs = await verifySymbolPairs(coin);
        return {
          ASSET: coin.asset,
          BAL: total,
          FREE: free,
          BTC: hasPairs ? await balanceToBTC(total, coin.asset) : 0,
        };
      }),
  );

  // filter balances for minimum $10 value
  const minumim = await exchangeValue(10, CONST.STABLE_PAIR, 'BTC');
  return formatedBalances.filter(balance => balance.BTC > minumim);
};

/*
  Receives array of balances from getBalances()
  returns total portfolio value in object { BTC: '', USD: '' }
*/
const getBudget = async (balances) => {
  let totalBTC = 0.0;
  await asyncForEach(balances, async (coin) => {
    if (coin.ASSET === 'BTC') {
      totalBTC += coin.BAL;
    } else {
      totalBTC += await exchangeValue(coin.BAL, coin.ASSET, 'BTC');
    }
  });
  return {
    BTC: totalBTC,
    USD: await exchangeValue(totalBTC, 'BTC', CONST.STABLE_PAIR),
  };
};

/*
  Check any substitute holdings to see if they should be sold
*/
const checkOnSubs = async (balances) => {
  const subHoldings = getSubHoldings(balances);
  await asyncForEach(subHoldings, async (balance) => {
    const coin = balance.ASSET;
    if (!(await tradeDecision(coin))) {
      const orderSpinner = ora({ indent: 2 }).start(
        `Selling substitute ${coin} holdings`,
      );
      await sendOrder(
        'SELL',
        await getBalance(coin),
        `${coin}${CONST.TRADE_PAIR}`,
        orderSpinner,
      );
    }
  });
};

/*
  Fills minimum balance set for BNB to save on trade fees
*/
const fillMinBNB = async () => {
  const amountShort = Math.ceil(CONST.MIN_BNB - (await getBalance('BNB')));
  if (amountShort > 0) {
    const orderSpinner = ora({ indent: 2 }).start(
      `Short ${amountShort} BNB from set minimum, attempting buy order`,
    );
    await verifyBuy(amountShort, 'BNB', orderSpinner);
  }
};

/*
  Spends any stable pair holdings on trade pair
*/
const spendStableHoldings = async () => {
  await asyncForEach(CONST.STABLE_PAIRS, async (coin) => {
    const bal = await getBalance(coin);
    if (bal > 1) {
      const quantity = await exchangeValue(bal, coin, CONST.TRADE_PAIR);
      const orderSpinner = ora({ indent: 2 }).start(
        `Using ${coin} holdings for ${quantity}${CONST.TRADE_PAIR}`,
      );
      await sendOrder(
        'BUY',
        quantity,
        `${CONST.TRADE_PAIR}${coin}`,
        orderSpinner,
        'MARKET',
      );
    }
  });
};

/*
  Fills fixed allocation percentages if bullish and sells coin holdings if not
*/
const tradeMainAllocations = async (budget) => {
  await asyncForEach(CONST.ALLOCATION_KEYS, async (coin) => {
    // check current value of coin if holding
    const bal = await getBalance(coin);
    const holdings = bal
      ? await exchangeValue(bal, coin, CONST.STABLE_PAIR)
      : 0;
    const orderSpinner = ora({ indent: 2 });
    // test trade criteria for order decision
    if (await tradeDecision(coin)) {
      // calculate amount of coin needed based on allocation
      const diff = await checkAllocation(coin, holdings, budget);
      // make trade if allocation is off by +-$50
      if (Math.abs(diff.USD) > CONST.USD_TRADE_MIN) {
        if (diff.USD > 0) {
          orderSpinner.start(
            `${coin} preferred allocation not met, attempting order`,
          );
          // limit initial buy-in to 25% of order in case of a false positive
          const quantity = holdings < CONST.USD_TRADE_MIN
            ? diff.QUANTITY * CONST.INITIAL_BUY_PERCENTAGE
            : diff.QUANTITY;
          await verifyBuy(quantity, coin, orderSpinner);
        } else if (CONST.TAKE_PROFITS) {
          orderSpinner.start(
            `${coin} allocation is too high, selling difference`,
          );
          await sendOrder(
            'SELL',
            diff.QUANTITY,
            `${coin}${CONST.TRADE_PAIR}`,
            orderSpinner,
          );
        }
      }
    } else if (CONST.HOLD_BNB && coin === 'BNB') {
      // sell any extra BNB if allocation is above min
      const diff = bal - CONST.MIN_BNB;
      const value = await exchangeValue(diff, 'BNB', CONST.STABLE_PAIR);
      if (diff > 0 && value > CONST.USD_TRADE_MIN) {
        orderSpinner.start(`Selling extra ${diff} BNB`);
        await sendOrder(
          'SELL',
          diff,
          `${coin}${CONST.TRADE_PAIR}`,
          orderSpinner,
        );
      }
    } else if (holdings > CONST.USD_TRADE_MIN) {
      // sell total current balance if bearish
      const tradeHist = await Binance.myTrades(`${coin}${CONST.TRADE_PAIR}`);
      const lastTrade = tradeHist.pop();
      const timeDiff = moment().diff(lastTrade.time, 'minutes', true);
      // minimize sell order after recent purchase in case of false negative
      if (lastTrade.isBuyer && timeDiff < 20) {
        orderSpinner.start(`Selling 25% of holdings for ${coin}`);
        await sendOrder(
          'SELL',
          bal * 0.25,
          `${coin}${CONST.TRADE_PAIR}`,
          orderSpinner,
        );
      } else {
        orderSpinner.start(`Selling all holdings for ${coin}`);
        await sendOrder(
          'SELL',
          bal,
          `${coin}${CONST.TRADE_PAIR}`,
          orderSpinner,
        );
      }
    }
  });
};

/*
  Places orders with remaining trade pair for substitute coins if bullish
*/
const tradeSubs = async (budget) => {
  const balances = await getBalances();
  // get remaining trade pair balance in USD
  let tradePairValue = await getTradePairUSDValue();

  if (tradePairValue > CONST.USD_TRADE_MIN) {
    // set max USD order value for each substitute
    const maxOrder = budget.USD * CONST.MAX_SUBSTITUTE_PERCENTAGE;

    // calculate recommended subs
    const recs = await recommender();
    if (recs.length > 0) {
      console.log(`
      =============================================
      Recomendations: (${tradePairValue} ${CONST.TRADE_PAIR} remaining)
      `);
      console.table(recs);
      let index = 0;
      // continue trading as long as you have enough excess value in USD
      (async function loop() {
        if (
          tradePairValue > CONST.USD_TRADE_MIN
          && maxOrder > CONST.USD_TRADE_MIN
          && recs[index]
        ) {
          const { COIN } = recs[index];
          const holding = balances.filter(balance => balance.ASSET === COIN)[0];
          const currentValue = holding
            ? await exchangeValue(holding.BAL, COIN, CONST.STABLE_PAIR)
            : 0;
          const diff = maxOrder - currentValue;

          if (diff > CONST.USD_TRADE_MIN) {
            const quantity = tradePairValue > diff
              ? await exchangeValue(diff, CONST.STABLE_PAIR, COIN)
              : await exchangeValue(tradePairValue, CONST.STABLE_PAIR, COIN);

            const orderSpinner = ora({ indent: 2 }).start(
              `Attempting order for ${quantity} ${COIN}`,
            );
            await sendOrder(
              'BUY',
              quantity,
              `${COIN}${CONST.TRADE_PAIR}`,
              orderSpinner,
            );
            tradePairValue -= diff;
          }
          index += 1;
          loop();
        }
      }());
    }
  }
};

/*
  Sells a percentage of each sub holding at market into your trade pair
*/
const liquidateSub = async (fundsNeeded) => {
  const balances = await getBalances();
  const subHoldings = getSubHoldings(balances);
  if (subHoldings.length > 0) {
    const subBudget = await getBudget(subHoldings);
    if (subBudget.USD * CONST.LIQUIDATE_SUB_PERCENTAGE > fundsNeeded) {
      // cut array in half no matter the size
      subHoldings.splice(0, Math.ceil(subHoldings.length / 2));
    }
    // Sell percentage of each sub holding
    await asyncForEach(subHoldings, async (sub) => {
      const orderSpinner = ora({ indent: 2 }).start(
        `Need more ${CONST.TRADE_PAIR} funds, selling ${
          CONST.LIQUIDATE_SUB_PERCENTAGE
        }% of ${sub.ASSET}`,
      );
      const quantity = sub.BAL * CONST.LIQUIDATE_SUB_PERCENTAGE;
      const value = await exchangeValue(quantity, sub.ASSET, CONST.TRADE_PAIR);

      let finalQuantity;
      if (value >= CONST.USD_TRADE_MIN) {
        finalQuantity = quantity;
      } else if (
        (await exchangeValue(sub.BAL, sub.ASSET, CONST.TRADE_PAIR))
        > CONST.USD_TRADE_MIN
      ) {
        finalQuantity = await exchangeValue(
          CONST.USD_TRADE_MIN,
          CONST.TRADE_PAIR,
          sub.ASSET,
        );
      } else finalQuantity = sub.BAL;

      await sendOrder(
        'SELL',
        finalQuantity,
        `${sub.ASSET}${CONST.TRADE_PAIR}`,
        orderSpinner,
        'MARKET',
      );
    });
  }
};

/*
  Returns true if in a bullish trend and trade should be made.
  NOTE: More indicators may be included to strengthen the trade decision
*/
const tradeDecision = async (coin, log = true) => {
  const symbol = coin + CONST.TRADE_PAIR;
  return (
    (await indicators.testMACD(symbol, log)) && indicators.testRSI(symbol, log)
  );
};

/*
 Handles sufficient balance verification for buy orders
*/
const verifyBuy = async (quantity, coin, orderSpinner) => {
  // sell sub holdings if not enough funds
  if (!(await checkFunds(quantity, coin))) {
    const fundsNeeded = await exchangeValue(quantity, coin, CONST.TRADE_PAIR);
    await liquidateSub(fundsNeeded);
  }

  if ((await getTradePairUSDValue()) < CONST.USD_TRADE_MIN && coin !== 'BNB') {
    orderSpinner.warn(`Not enough ${CONST.TRADE_PAIR} funds, skipping order`);
  } else {
    // set quantity to max bal if still not enough funds
    const total = (await checkFunds(quantity, coin))
      ? quantity
      : await exchangeValue(
        await getBalance(CONST.TRADE_PAIR),
        CONST.TRADE_PAIR,
        coin,
      );

    await sendOrder('BUY', total, `${coin}${CONST.TRADE_PAIR}`, orderSpinner);
  }
};
