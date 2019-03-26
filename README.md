# CryptoBot

## NodeJS trading bot for Binance

This is an experimental terminal bot for auto trading on binance.com exchange

## Configuration

1.  [Signup](https://www.binance.com/?ref=11635276) for Binance
2.  Enable Two-factor Authentication
3.  Go API Center, [Create New](https://www.binance.com/userCenter/createApi.html) Api Key

        [✓] Read Info [✓] Enable Trading [X] Enable Withdrawals

4.  Create `.env` file and insert API and Secret Keys
        
        API_KEY=''
        API_SECRET=''

5.  Optional: alter bot presets such as allocation or MACD periods in `constants.js`

## Dependencies

[binance-api-node](https://github.com/binance-exchange/binance-api-node)

[technicalindicators](https://github.com/anandanand84/technicalindicators)

## Usage

    yarn install
    yarn start

## Run in a Docker container

    Coming soon

## DISCLAIMER

    Use this bot at your own risk. I am not responsible for any potential losses.
    There are no warranties or guarantees expressed or implied.
    You assume all responsibility and liability.

## Contributing

    Fork this Repo
    Commit your changes (git commit -m 'Add some feature')
    Push to the changes (git push)
    Create a new Pull Request

## Roadmap

- [x] Configure Binance API routes
- [x] Set main structure with balance, budget, and allocation functionality
- [x] Place buy and sell orders
- [x] Calculate MACD values
- [ ] Calculate RSI values
- [ ] Get sentiment analysis from Twitter or StockTwits
- [ ] Get major news alerts
- [ ] Intergrate [coindar callendar](https://coindar.org) for upcoming news
- [ ] Develop algo for selecting top 5 altcoins
- [ ] Finish app tests
- [ ] Release V1
- [ ] Add configurations for other technical indicators
- [ ] Integrate Docker
- [ ] Release V2

## License

Code released under the [MIT License](https://opensource.org/licenses/MIT).

---
