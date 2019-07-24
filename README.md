# CryptoBot

## NodeJS trading bot for Binance

This is an experimental terminal bot for auto trading on binance.com exchange.

Due to Binance suspending US customers from their site, I have postponed development until further details are released about Binance US. 

## Configuration

1.  [Signup](https://www.binance.com/?ref=11635276) for Binance
2.  Enable Two-factor Authentication
3.  Go to API Center, [Create New](https://www.binance.com/userCenter/createApi.html) Api Key

        [✓] Read Info [✓] Enable Trading [] Enable Withdrawals

4.  Create a `.env` file and insert your API and Secret Keys

    API_KEY=...

    API_SECRET=...

5.  If holding BNB, turn on using BNB for trade fees in your [account](https://www.binance.com/userCenter/myAccount.html) to save 25%. Option to hold BNB along with the min balance can be set in the `constants.js` file. More about trade fees and tiers can be found [here](https://www.binance.com/en/fee/schedule).

6.  Optional: alter additional bot presets such as portfolio allocation or trade intervals in `constants.js`
7.  Make sure to turn off your computers energy saving settings so that your terminal process won't pause if your computer goes to sleep. Alternatively, you can prepend `caffeinate` to your start command.

---

## Dependencies

[binance-api-node](https://github.com/binance-exchange/binance-api-node)

[chart_utils](https://github.com/vpfautz/chart_utils)

## Usage

    yarn start:dev - (starts the development server for testing. No real orders will be sent.)

    yarn start - (creates a build and runs the production server. Warning: orders are now live.)

## Run in a Docker container

[Install Docker](https://docs.docker.com/install/)

    # Build the image
    $ docker build -t bot-img .

    # Run the image
    $ docker run -d -ti --name crypto-bot bot-img

    # Print bots output logs
    $ docker logs crypto-bot

    # If you want to enter the container
    $ docker attach crypto-bot

    # If you want to stop the container
    $ docker stop crypto-bot

    # If you want to clean unused containers/images
    $ docker system prune

## DISCLAIMER

    Use this bot at your own risk. I am not responsible for any potential losses.
    There are no warranties or guarantees expressed or implied.
    You assume all responsibility and liability.

## Contributing

    Fork this Repo
    Commit and push your changes
    Create a new Pull Request

## Roadmap

- [x] Configure Binance API routes
- [x] Set main structure with balance, budget, and allocation functionality
- [x] Handle logic for buy and sell orders
- [x] Calculate MACD values
- [x] Calculate RSI values
- [x] Setup cron task
- [x] Add environment variables for dev and production
- [x] Handle BNB min holdings
- [x] Allow custom trade or stable pairs
- [x] Release V1
- [x] Set-up Docker
- [x] Clean-up log outputs with tables and ora spinners
- [ ] Integrate websockets and batch orders
- [ ] Handle upcoming margin additions to Binance
- [ ] Add configurations for other technical indicators
- [ ] Release V2
- [ ] Get sentiment analysis from Twitter or StockTwits
- [ ] Integrate [coindar calendar](https://coindar.org) for upcoming news
- [ ] Develop algo for selecting top 5 altcoins
- [ ] Release V3

## Donate

BTC: 18j1UsoK98sdkHtJg1aaRw1ZsdEDfGRCRh

LTC: LXRhTEmydq7M8cw3W9stD2xH4f167USWHJ

ETH: 0xfa00fb818a26bf8eda9726d80d6d8d6fbf4d97bd

---

## License

Code released under the [MIT License](https://opensource.org/licenses/MIT).

---
