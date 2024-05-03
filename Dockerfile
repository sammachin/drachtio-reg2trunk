FROM drachtio/drachtio-server:0.8.25

RUN apt-get update && \
  apt-get install --quiet -y nodejs npm && \
  npm install -g pm2@latest

ADD entrypoint.sh /entrypoint.sh

WORKDIR /app

ADD . .

RUN npm install --production

ENV R2T_PORT="3000"
ENV R2T_REGHOST="default.jbsip.sammachin.com"
ENV R2T_REGIP="192.168.1.12"
ENV R2T_TRUNKIP="192.168.1.163"
ENV R2T_TRUNKTRANSPORT="udp"
ENV R2T_REGTRANSPORT="udp"
ENV R2T_LOCALIP="192.168.1.10"
ENV R2T_LOCALPORT="10222"

EXPOSE ${R2T_PORT}

