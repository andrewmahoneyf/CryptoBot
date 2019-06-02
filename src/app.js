import moment from 'moment';
import * as Binance from '../api/binance';
import * as indicators from './indicators';
import * as CONST from './constants';
import scheduleJob from './job';
import {
  asyncForEach,
  exchangeValue,
  balanceToBTC,
  parseBalances,
  sendOrder,
  getBalance,
  checkAllocation,
  checkFunds,
  getTradePairUSDValue,
  getSubHoldings,
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
  // 3. verify current funds
  const balances = await getBalances();
  console.log('Balances:', balances);
  const budget = await getBudget(balances);
  console.log('Budget:', budget);

  if (budget.USD > CONST.USD_TRADE_MIN) {
    // 3. check if substitute positions should be sold
    await checkOnSubs(balances);
    // 4. check BNB balance if min holding set
    if (CONST.HOLD_BNB) await fillMinBNB();
    // 5. trade main allocations
    await tradeMainAllocations(budget);
    // 6. trade substitute coins
    if (CONST.TRADE_SUBS) await tradeSubs(budget);
  } else {
    console.log('Need more funds in your account');
  }
});

/*
  Returns an array of all current portfolio balances with
  a minimum value of over $10 and provides their value in BTC
  [ { ASSET: 'ETH', BAL: 2.5, FREE: 2, BTC: .005 }, ... ]
*/
const getBalances = async () => {
  const result = await Binance.client.accountInfo();

  const formatedBalances = await Promise.all(
    result.balances
      .filter(coin => coin.free > 0 || coin.locked > 0)
      .map(async (coin) => {
        const { free, total } = parseBalances(coin);
        return {
          ASSET: coin.asset,
          BAL: total,
          FREE: free,
          BTC: await balanceToBTC(total, coin.asset),
        };
      }),
  );

  // filter balances for minimum $10 value
  const minumim = await exchangeValue(10, CONST.STABLE_PAIR, 'BTC');
  return formatedBalances.filter(coin => coin.BTC > minumim);
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
  Cancels all outstanding orders
*/
const cancelOrders = async () => {
  const orders = await Binance.client.openOrders();
  await asyncForEach(orders, async (order) => {
    await Binance.cancelOrder(order.symbol, order.orderId);
  });
};

/*
  Check any substitute holdings to see if they should be sold
*/
const checkOnSubs = async (balances) => {
  const subHoldings = getSubHoldings(balances);
  await asyncForEach(subHoldings, async (balance) => {
    const coin = balance.ASSET;
    if (!(await tradeDecision(coin))) {
      await sendOrder('SELL', await getBalance(coin), coin);
    }
  });
};

/*
  Fills minimum balance set for BNB to save on trade fees
*/
const fillMinBNB = async () => {
  const amountShort = Math.ceil(CONST.MIN_BNB - (await getBalance('BNB')));
  if (amountShort > 0) {
    console.log(`Short ${amountShort} BNB from set minimum, attempting buy order`);
    await verifyBuy(amountShort, 'BNB');
  }
};

/*
  Fills fixed allocation percentages if bullish and sells coin holdings if not
*/
const tradeMainAllocations = async (budget) => {
  await asyncForEach(CONST.ALLOCATION_KEYS, async (coin) => {
    // check current value of coin if holding
    const bal = await getBalance(coin);
    const holdings = bal ? await exchangeValue(bal, coin, CONST.STABLE_PAIR) : 0;

    // test trade criteria for order decision
    if (await tradeDecision(coin)) {
      // calculate amount of coin needed based on allocation
      const diff = await checkAllocation(coin, holdings, budget);
      // make trade if allocation is off by +-$50
      if (Math.abs(diff.USD) > CONST.USD_TRADE_MIN) {
        if (diff.USD > 0) {
          console.log(`${coin} preferred allocation not met, attempting order`);
          await verifyBuy(diff.QUANTITY, coin);
        } else {
          console.log(`${coin} allocation is too high, selling difference`);
          await sendOrder('SELL', diff.QUANTITY, coin);
        }
      }
    } else if (holdings > CONST.USD_TRADE_MIN) {
      // sell total current balance if bearish
      if (coin !== 'BNB' || !CONST.HOLD_BNB) await sendOrder('SELL', bal, coin);
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

  // set max USD order value for each substitute
  const maxOrder = budget.USD * CONST.MAX_SUBSTITUTE_PERCENTAGE;

  let index = 0;
  // continue trading as long as you have enough excess value in USD
  (async function loop() {
    if (
      tradePairValue > CONST.USD_TRADE_MIN
      && maxOrder > CONST.USD_TRADE_MIN
      && CONST.SUBSTITUTES[index]
    ) {
      const coin = CONST.SUBSTITUTES[index];
      const holding = balances.filter(balance => balance.ASSET === coin);
      const makeTrade = holding.length > 0 ? false : await tradeDecision(coin);
      if (makeTrade) {
        const total = tradePairValue > maxOrder
          ? await exchangeValue(maxOrder, CONST.STABLE_PAIR, coin)
          : await exchangeValue(tradePairValue, CONST.STABLE_PAIR, coin);

        await sendOrder('BUY', total, coin);
        tradePairValue -= maxOrder;
      }
      index += 1;
      loop();
    }
  }());
};

/*
  Sells coin holdings into your trade pair if not included in main allocation
  Returns true if enough funds are now met
*/
const liquidateSubs = async (quantity, coin) => {
  const balances = await getBalances();
  const subHoldings = getSubHoldings(balances);
  if (subHoldings.length > 0) {
    console.log(`Need more ${CONST.TRADE_PAIR} funds, liquidating substitutes`);
    await asyncForEach(subHoldings, async asset => sendOrder('SELL', asset.BAL, asset.ASSET));
    return checkFunds(quantity, coin);
  }
  return false;
};

/*
  Returns true if in a bullish trend and trade should be made.
  NOTE: More indicators may be included to strengthen the trade decision
*/
const tradeDecision = async (coin) => {
  const symbol = coin + CONST.TRADE_PAIR;
  return (await indicators.testMACD(symbol)) && indicators.testRSI(symbol);
};

/*
 Handles sufficient balance verification for buy orders
*/
const verifyBuy = async (quantity, coin) => {
  let enoughFunds = await checkFunds(quantity, coin);
  if (!enoughFunds) {
    // sell any substitute coins and retry
    enoughFunds = await liquidateSubs(quantity, coin);
  }
  if ((await getTradePairUSDValue()) > CONST.USD_TRADE_MIN || coin === 'BNB') {
    // set quantity to max bal if still not enough funds
    const total = enoughFunds
      ? quantity
      : await exchangeValue(await getBalance(CONST.TRADE_PAIR), CONST.TRADE_PAIR, coin);

    await sendOrder('BUY', total, coin);
  } else {
    console.log(`Not enough ${CONST.TRADE_PAIR} funds, skipping order`);
  }
};
