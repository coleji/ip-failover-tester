FROM node:16
RUN mkdir /app
COPY src /app/src
COPY node_modules /app/node_modules
CMD cd /app && \
echo "hosts=$HOSTS" > config.ini && \
echo "timeoutSeconds=$TIMEOUT_SECONDS" >> config.ini && \
echo "runIntervalSeconds=$RUN_INTERVAL_SECONDS" >> config.ini && \
echo "assertEveryHours=$ASSERT_EVERY_HOURS" >> config.ini && \
exec nodejs src/index.js
