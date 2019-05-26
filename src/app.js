import cron from 'node-cron';
import * as client from '../api/binance';
import * as indicators from './indicators';
import * as CONST from './constants';
import {
  asyncForEach,
  exchangeValue,
  formatBalances,
  sendOrder,
  getBalance,
  checkAllocation,
  checkFunds,
  cancelOrders
} from './helpers';

/*
  ==============   Main app method  ================
  Checks API, gets balances, calculates total budget
  Decides to  trade in and out of BTC, ETH, LTC
  And then trades BTC holdings with ALtcoins
*/
cron
  .schedule(CONST.CRON_SCHEDULE, async () => {
    // 1. test connectivity to the API then log server time
    (await client.ping) && client.time;

    // 2. verify current funds
    const balances = await getBalances();
    console.log(`Balances: ${balances}`);
    await asyncForEach(balances, async coin => {
      await cancelOrders(coin.ASSET + 'USDT');
    });
    const budget = await getBudget(balances);
    console.log(`Budget: ${budget}`);

    // 3. trade main allocations
    await tradeMainAllocations(budget);

    // 4. trade substitute coins
    const remainingUSD = await getBalance('USDT');
    if (remainingUSD > CONST.USD_TRADE_MIN) {
      console.log('Testing remaining USD with substitues');
      await tradeSubstitutes(budget, remainingUSD);
    } else {
      console.log(`No substitutes needed. Remaining USD: $${remainingUSD}`);
    }
  })
  .start();

/* 
  Returns an array of all current portfolio balances with
  a minimum value of over $10 and provides their value in BTC
  [ { asset: 'ETH', bal: 2.5, btc: .005 }, ... ] 
*/
const getBalances = async () => {
  const balances = await formatBalances();
  // Add BTC value key and filter minimum $10 valeu
  const minumim = await exchangeValue(10, 'USDT', 'BTC');
  await asyncForEach(balances, async coin => {
    coin.BTC =
      coin.ASSET === 'BTC'
        ? coin.BAL
        : await exchangeValue(coin.BAL, coin.ASSET, 'BTC');
  });
  return balances.filter(coin => coin.BTC > minumim);
};

/* 
  Receives array of balances from getBalances()  
  returns total portfolio value in object { BTC: '', USD: '' }
*/
const getBudget = async balances => {
  let totalBTC = 0.0;
  await asyncForEach(balances, async coin => {
    if (coin.ASSET === 'BTC') {
      totalBTC += coin.BAL;
    } else {
      totalBTC += await exchangeValue(coin.BAL, coin.ASSET, 'BTC');
    }
  });
  return {
    BTC: totalBTC,
    USD: await exchangeValue(totalBTC, 'BTC', 'USDT')
  };
};

/*
  Fills fixed allocation percentages if bullish and max sells coin if not
*/
const tradeMainAllocations = async budget => {
  const coins = Object.keys(CONST.ALLOCATION);
  await asyncForEach(coins, async coin => {
    // Check current value of coin if holding
    const bal = await getBalance(coin);
    const holdings = bal ? await exchangeValue(bal, coin, 'USDT') : 0;
    // Test trade criteria for order decision
    const makeTrade = await tradeDecision(coin + 'USDT');

    if (makeTrade) {
      // calculate amount of coin needed based on allocation
      const diff = await checkAllocation(coin, holdings, budget);
      // Make trade if allocation is off by +-$50
      if (Math.abs(diff.USD) > CONST.USD_TRADE_MIN) {
        diff.USD > 0 && (await order('BUY', diff.QUANTITY, coin, 'USDT'));
        diff.USD < 0 && (await order('SELL', diff.QUANTITY, coin, 'USDT'));
      }
    } else {
      // sell total current balance if negative
      if (holdings > CONST.USD_TRADE_MIN)
        await order('SELL', bal, coin, 'USDT');
    }
  });
};

/*
  Places orders with remaining USD for substitute coins if bullish
*/
const tradeSubstitutes = async (budget, remainingUSD) => {
  // set max order USD value for each substitute
  const maxOrder = budget.USD * CONST.MAX_SUBSTITUTE_PERCENTAGE;
  await asyncForEach(CONST.SUBSTITUTES, async coin => {
    // continue trading as long as you have enough USD
    if (remainingUSD > CONST.USD_TRADE_MIN) {
      const makeTrade = await tradeDecision(coin, 'USDT');
      if (makeTrade) {
        const total =
          remainingUSD > maxOrder
            ? await exchangeValue(maxOrder, 'USDT', coin)
            : await exchangeValue(remainingUSD, 'USDT', coin);

        await order('BUY', total, coin, 'USDT');
        remainingUSD -= maxOrder;
      }
    }
  });
};

/*
  Sells coin holdings into USDT if not included in main allocation
*/
const liquidateSubstitutes = async () => {
  const balances = await getBalances();
  const mainCrypto = Object.keys(CONST.ALLOCATION);
  const alts = balances.filter(balance => !mainCrypto.includes(balance.ASSET));

  await asyncForEach(
    alts,
    async alt => await order('SELL', alt.BAL, alt.ASSET, 'USDT')
  );
};

/*
  Returns true if in a bullish trend and trade should be made.
  More indicators will be included to strengthen the trade decision
*/
const tradeDecision = async symbol =>
  (await indicators.testMACD(symbol)) && (await indicators.testRSI(symbol));

/*
 Handles orders checking for type and sufficient balances if buy
*/
const order = async (side, quantity, coin, pair) => {
  if (side === 'SELL') {
    await sendOrder(side, quantity, coin + pair);
  } else {
    let enoughFunds = await checkFunds(quantity, coin, pair);
    if (!enoughFunds) {
      // sell any substitute coins and retry
      console.log(`Need more ${pair} funds, liquidating substitutes`);
      await liquidateSubstitutes();
      enoughFunds = await checkFunds(quantity, coin, pair);
    }
    // set quantity to max bal if still not enough funds
    const usdBal = await getBalance(pair);
    if (usdBal > CONST.USD_TRADE_MIN) {
      console.log('Min trade amount met, sending buy order');
      const total = enoughFunds
        ? quantity
        : await exchangeValue(usdBal, pair, coin);

      await sendOrder(side, total, coin + pair);
    }
  }
};
