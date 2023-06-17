FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY . .

RUN npm install -g npminstall --registry=https://registry.npmmirror.com \
  && npminstall -c \
  && npm run tsc

ENV NODE_ENV=production \
  EGG_SERVER_ENV=prod

EXPOSE 7001
CMD ["npm", "run", "start:foreground"]
