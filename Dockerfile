FROM node:20-alpine

WORKDIR /app
COPY package.json ./package.json
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN yarn install

# Copy app source
COPY . .
EXPOSE 8080

CMD [ "yarn", "start" ]
