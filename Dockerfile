FROM node:12.2.0-alpine

# Set user to satoshi to avoid running from root
RUN deluser --remove-home node \
    && addgroup -S node -g 1000 \
    && adduser -S -G node -u 1000 satoshi

# Create bot directory
RUN mkdir -p /home/satoshi/bot
WORKDIR /home/satoshi/bot

# Install bot dependencies
COPY package.json yarn.lock ./
RUN apk add --no-cache --virtual .gyp python make g++ libc6-compat alpine-sdk \
    && yarn \
    && apk del .gyp \
    && chown -R satoshi /home/satoshi/bot \
    && chmod 755 /home/satoshi/bot

# Bundle bot source
COPY . . 

ENV NODE_ENV production
ENV TF_CPP_MIN_LOG_LEVEL 3

USER satoshi
CMD [ "yarn", "start" ]