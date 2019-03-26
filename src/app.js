import * as client from '../api/binance';
import { asyncForEach, exchangeValue } from './helpers';
import * as CONST from './constants';
import { testMACD } from './indicators/macd';

/* 
  ==============   Main app method  ================
  Checks API, gets balances, calculates total budget
  Decides to  trade in and out of BTC, ETH, LTC
  And then trades BTC holdings with ALtcoins
*/
const main = async () => {
  // 1. test connectivity to the API then log server time
  (await client.ping) && client.time;

  // 2. Verify current funds
  const balances = await getBalances();
  console.log('balances', balances);
  const budget = await getBudget(balances);
  console.log('Budget', budget);

  // 3. trade stable pairs
  // TODO: return promise so altocoins dont trade until complete
  await tradeStablePairs(budget);

  // 4. trade altcoins
  await liquidateAlts();
  const BTC = await getBalance('BTC');
  console.log('BTC ending bal', BTC);
  if (BTC.free > 0) {
    const top5 = getTopAlts();
    await tradeAlts(top5, BTC.free);
  }
};

/* 
  Returns an array of all current portfolio balances
  [ { asset: 'ETH', free: '', locked: '' }, ... ] 
*/
const getBalances = async () => {
  const result = await client.accountInfo;
  return result.balances.filter(coin => coin.free > 0 || coin.locked > 0);
};

/* 
  Returns double value of current balance for received symbol ex: 'BTC'
*/
const getBalance = async symbol => {
  const result = await client.accountInfo;
  return result.balances
    .filter(coin => coin.asset === symbol)
    .map(coin => parseFloat(coin.free) + parseFloat(coin.locked))[0];
};

/* 
  Receives array of balances from getBalances()  
  returns total portfolio value in object { BTC: '', USD: '' }
*/
const getBudget = async balances => {
  let totalBtc = 0.0;
  const USDT = await exchangeValue('BTC', 'USDT');
  await asyncForEach(balances, async coin => {
    const bal = await getBalance(coin.asset);
    if (coin.asset === 'BTC') {
      totalBtc += bal;
    } else if (coin.asset === 'USDT') {
      totalBtc += bal / USDT;
    } else {
      const btcValue = await exchangeValue(coin.asset, 'BTC');
      totalBtc += bal * btcValue;
    }
  });

  return { BTC: totalBtc, USD: totalBtc * USDT };
};

/*
  Checks trade opportunities for BTC, ETH, and LTC
  Allocates a fixed percentage of funds set in constants
*/
const tradeStablePairs = async budget => {
  await asyncForEach(CONST.STABLE_PAIRS, async coin => {
    // Test MACD with USD values for all positive histograms
    const positive = await testMACD(coin, 'USDT');

    // Buy or sell stable positions based on MACD valuation
    if (positive) {
      if (coin !== 'BTC') {
        // calculate amount of coin needed based on allocation
        const diff = await checkAllocation(coin, budget);

        // Make trade if allocation is off by +-$50
        if (Math.abs(diff.USD) > 50) {
          diff.USD > 0 && (await buy(coin, diff.QUANTITY));
          diff.USD < 0 && (await order('SELL', coin, 'BTC', diff.QUANTITY));
        }
      } else {
        // spend any remaining USDT on BTC
        await maxOrder('BUY', coin, 'USDT');
      }
    } else {
      // liquidate alts and then sell all BTC
      coin === 'BTC' && (await liquidateAlts());
      // sell total current balance
      await maxOrder('SELL', coin, 'USDT');
    }
  });
};

/*
 Checks if current allocation is off from the set const.
 Returns amount of difference in USDT value along with quantity of coin needed 
 { USD: $500, AMOUNT: 2.576 }
*/
const checkAllocation = async (coin, budget) => {
  // Check current value of coin if holding
  const currBal = await getBalance(coin);
  const exchange = await exchangeValue(coin, 'USDT');
  const currValue = currBal ? currBal * exchange : 0;

  // Check allocation % and calculate amount difference
  const allocation = budget.USD * CONST.ALLOCATION[coin];
  const diff = allocation - currValue;

  return { USD: diff, QUANTITY: Math.abs(diff) / exchange };
};

// TODO: function to select top 5 altcoins
const getTopAlts = async () => {};

/*
  Trade all BTC into top 5 coins
*/
const tradeAlts = async (top5, btc) => {
  const amount = btc / 5;
  await asyncForEach(top5, async alt => {
    const exchange = await exchangeValue(alt, 'BTC');
    const quantity = amount / exchange;
    await buy(alt, quantity);
  });
};

/*
 Check balances and put in buy orders for stable or alt pairs
 Liquidates BTC if needed
*/
const buy = async (coin, quantity) => {
  console.log('buy:', coin, quantity);

  // Check if stable pair so USDT will be used
  if (CONST.STABLE_PAIRS.includes(coin)) {
    const sufficientUSDT = await checkQuantity(coin, quantity, 'USDT');

    if (sufficientUSDT) {
      // process order with USDT balance
      console.log('have enough USDT funds');
      await order('BUY', coin, 'USDT', quantity);
    } else {
      // process order with any remaining USDT + BTC or Alts
      console.log('Need more USDT funds, use BTC');
      const orderQuantity = await maxOrder('BUY', coin, 'USDT');
      const newQuantity = quantity - orderQuantity;
      const sufficientBTC = await checkQuantity(coin, newQuantity, 'BTC');
      if (sufficientBTC) {
        // process remaining quantity with BTC
        console.log('Have enough BTC funds');
        await maxOrder('BUY', coin, 'BTC');
      } else {
        // sell altcoins and buy with BTC
        console.log('Need more BTC funds, liquidate Alts');
        await liquidateAlts();
        await maxOrder('BUY', coin, 'BTC');
      }
    }
  } else {
    // Altcoin order
    const sufficientBTC = await checkQuantity(coin, quantity, 'BTC');
    if (sufficientBTC) {
      // process order with BTC balance
      console.log('Have enough BTC funds');
      await order('BUY', coin, 'BTC', quantity);
    } else {
      // max order alt
      console.log('Buying as much as possible');
      await maxOrder('BUY', coin, 'BTC');
    }
  }
};

/*
  Check fill quantity to verify if there is enough funds for an order
*/
const checkQuantity = async (coin, quantity, pair) => {
  const pairBal = await getBalance(pair);
  const exchange = await exchangeValue(coin, pair);
  const value = quantity * exchange;

  return value < pairBal;
};

/*
  Puts in a max order for type 'BUY' or 'SELL'
*/
const maxOrder = async (type, coin, pair) => {
  console.log('MAX_ORDER:', type, coin, pair);
  if (type === 'BUY') {
    // get pair balance and place order for all
    const bal = await getBalance(pair);
    const exchange = await exchangeValue(coin, pair);
    const quantity = bal / exchange;
    quantity > 0 && (await order('BUY', coin, pair, quantity));
    return quantity;
  } else {
    // get coin current balance and sell all
    const currBal = await getBalance(coin);
    await order('SELL', coin, pair, currBal);
    return currBal;
  }
};

/*
  Finalize price and put in order type 'BUY' or 'SELL'
*/
const order = async (type, coin, pair, quantity) => {
  console.log('ORDER:', type, coin, pair, quantity);
  const price = await getLimit(coin, pair);
  // await client.order(coin + pair, type, quantity, price);
};

/*
  Helper function that looks at books and determines limit price to set
*/
const getLimit = async (symbol, pair) => {
  // Get the order book for a pair
  //console.log(await client.book(symbol + pair));
  // Retrieves Candlestick for a symbol
  // Candlesticks are uniquely identified by their open time
  //console.log(await client.candles(symbol + pair));
  // return limit
};

/*
  Sell all Altcoins holdings into BTC
*/
const liquidateAlts = async () => {
  const balances = await getBalances();
  await asyncForEach(balances, async alt => {
    if (
      alt.asset !== 'BTC' &&
      alt.asset !== 'USDT' &&
      alt.asset !== 'ETH' &&
      alt.asset !== 'LTC'
    ) {
      await cancelOrders(alt.asset, 'BTC');
      await maxOrder('SELL', alt.asset, 'BTC');
    }
  });
};

/*
  Cancel all orders for a coin
*/
const cancelOrders = async (coin, pair) => {
  const orders = await client.openOrders(coin + pair);
  console.log('openOrders:', orders);

  await asyncForEach(orders, async order => {
    await client.cancelOrder(coin + pair, order.orderId);
  });
};

main();
