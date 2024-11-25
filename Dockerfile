FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY . .

# NPM Mirror
# npm install -g npminstall --registry=https://registry.npmmirror.com
# apk add --no-cache socat \  
RUN apt-get update \
  && apt-get -y install socat \
  && npm install -g npminstall \ 
  && npminstall -c \
  && npm run tsc

ENV NODE_ENV=production \
  EGG_SERVER_ENV=prod

EXPOSE 7001
CMD ["npm", "run", "start:foreground"]
