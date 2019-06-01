import * as client from '../api/binance';
import * as indicators from './indicators';
import * as CONST from './constants';
import scheduleJob from './job';
import {
  asyncForEach,
  exchangeValue,
  formatBalances,
  sendOrder,
  getBalance,
  checkAllocation,
  checkFunds,
  getTradePairUSDValue,
  getSubHoldings,
  updateBalances,
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
  await client.ping;
  await client.time;
  // 2. cancel any outstanding orders
  await cancelOrders();
  // 3. verify current funds
  const balances = await getBalances();
  // const clean = await client.clean;
  console.log('Balances:', balances);
  // console.log('Clean:', clean);
  const budget = await getBudget(balances);
  console.log('Budget:', budget);

  if (budget.USD > CONST.USD_TRADE_MIN) {
    // 3. check if substitute positions should be sold
    const updatedBalances = await checkOnSubs(balances);
    // 4. check BNB balance if min holding set
    if (CONST.HOLD_BNB) await fillMinBNB();
    // 5. trade main allocations
    await tradeMainAllocations(budget, updatedBalances);
    // 6. trade substitute coins
    await tradeSubs(budget);
  } else {
    console.log('Need more funds in your account');
  }
});

/*
  Returns an array of all current portfolio balances with
  a minimum value of over $10 and provides their value in BTC
  [ { ASSET: 'ETH', BAL: 2.5, BTC: .005 }, ... ]
*/
const getBalances = async () => {
  const formatedBalances = await formatBalances();
  // add BTC value key and filter minimum $10 value
  const minumim = await exchangeValue(10, CONST.STABLE_PAIR, 'BTC');
  await asyncForEach(formatedBalances, async (coin) => {
    // eslint-disable-next-line no-param-reassign
    coin.BTC = coin.ASSET === 'BTC' ? coin.BAL : await exchangeValue(coin.BAL, coin.ASSET, 'BTC');
  });
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
  const orders = await client.openOrders();
  await asyncForEach(orders, async (order) => {
    await client.cancelOrder(order.symbol, order.orderId);
  });
};

/*
  Check any substitute holdings to see if they should be sold
*/
const checkOnSubs = async (balances) => {
  const subHoldings = getSubHoldings(balances);
  let updatedBalances = balances;
  let changed = false;
  await asyncForEach(subHoldings, async (balance) => {
    const coin = balance.ASSET;
    if (!(await tradeDecision(coin))) {
      await sendOrder('SELL', await getBalance(coin), coin);
      updatedBalances = updateBalances(updatedBalances, coin);
      changed = true;
    }
  });
  if (changed) {
    console.log('Updated balances:', updatedBalances);
  }
  return updatedBalances;
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
const tradeMainAllocations = async (budget, balances) => {
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
        if (diff.USD > 0) await verifyBuy(diff.QUANTITY, coin, balances);
        else await sendOrder('SELL', diff.QUANTITY, coin);
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
      const makeTrade = await tradeDecision(coin);
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
const liquidateSubs = async (quantity, coin, balances) => {
  console.log(`Need more ${CONST.TRADE_PAIR} funds, liquidating substitutes`);
  const subHoldings = getSubHoldings(balances);

  await asyncForEach(subHoldings, async asset => sendOrder('SELL', asset.BAL, asset.ASSET));
  return checkFunds(quantity, coin);
};

/*
  Sells lower allocation coins into your trade pair until enough funds are available
  Returns true if enough funds are now met
*/
const liquidateLowAllocations = async (quantity, coin, balances) => {
  console.log(`Still need more ${CONST.TRADE_PAIR} funds, liquidating lower allocations`);
  const allocation = CONST.ALLOCATION[coin];
  const lowBalances = balances.filter(
    balance => CONST.ALLOCATION[balance.ASSET] < allocation && balance.ASSET !== 'BNB',
  );

  let index = 0;
  let enoughFunds = false;
  (async function loop() {
    if (!enoughFunds && lowBalances[index]) {
      const asset = lowBalances[index];
      await sendOrder('SELL', asset.BAL, asset.ASSET);
      index += 1;
      enoughFunds = await checkFunds(quantity, coin);
      loop();
    }
  }());
  return checkFunds(quantity, coin);
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
const verifyBuy = async (quantity, coin, balances) => {
  let enoughFunds = await checkFunds(quantity, coin);
  if (!enoughFunds) {
    // sell any substitute coins and retry
    enoughFunds = await liquidateSubs(quantity, coin, balances);
  }
  if (!enoughFunds) {
    // sell low allocation coins until you have enough
    enoughFunds = await liquidateLowAllocations(quantity, coin, balances);
  }
  // set quantity to max bal if still not enough funds
  if ((await getTradePairUSDValue()) > CONST.USD_TRADE_MIN) {
    console.log('Min trade amount met, sending buy order');
    const pairBal = await getBalance(CONST.TRADE_PAIR);
    const total = enoughFunds ? quantity : await exchangeValue(pairBal, CONST.TRADE_PAIR, coin);

    await sendOrder('BUY', total, coin);
  } else {
    console.log(`Not enough ${CONST.TRADE_PAIR} funds, skipping order`);
  }
};
