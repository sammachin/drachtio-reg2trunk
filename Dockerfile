FROM drachtio/drachtio-server:0.8.24

# RUN apt-get update && \
#   apt-get install --quiet -y nodejs npm && \
#   npm install -g pm2@latest

ADD entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /app

ADD . .

# RUN npm install --production

ENV R2T_PORT="3000"
ENV R2T_REGHOST="clients.sip.poc.emf.camp"
ENV R2T_REGIP="90.155.21.62"
ENV R2T_TRUNKIP="90.155.21.60"
ENV R2T_TRUNKTRANSPORT="udp"
ENV R2T_REGTRANSPORT="tcp"
ENV R2T_LOCALIP="90.155.21.58"
ENV R2T_LOCALPORT="10222"
ENV DRACHTIO_SIPPORT="5060"
ENV DRACHTIO_PUBLICIP="90.155.21.58"

EXPOSE ${R2T_PORT}

