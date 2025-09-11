FROM node:22-alpine

WORKDIR /app
COPY package.json ./package.json
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN yarn install

# Copy app source
COPY . .
EXPOSE 8009

CMD [ "yarn", "start" ]
