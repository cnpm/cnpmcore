# https://stackoverflow.com/questions/65612411/forcing-docker-to-use-linux-amd64-platform-by-default-on-macos/69636473#69636473
FROM --platform=linux/amd64 node:18

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY . .

RUN npm config set registry https://registry.npmmirror.com \
  && npm install -g npminstall \
  && npmupdate -c \
  && npm run tsc

ENV NODE_ENV=production
ENV EGG_SERVER_ENV=prod

EXPOSE 7001
CMD ["npm", "run", "start:foreground"]
