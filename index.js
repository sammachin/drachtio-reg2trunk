const Srf = require('drachtio-srf');
const srf = new Srf();
const {register, numbers} = require('./lib/utils');
const parseUri = require('drachtio-sip').parser.parseUri;
const express = require('express')

const WEBPORT = 3000
const REGHOST = "default.jbsip.sammachin.com"
const REGIP = "192.168.1.12"
const TRUNKIP = "192.168.1.163"

// Drachtio
srf.on('connect', (err, hostport) => {
  console.log(`connected to a drachtio server listening on: ${hostport}`);
});

srf.invite((req, res) => {
    const uri = parseUri(req.uri);
    const sender = parseUri(req.getParsedHeader('From').uri)
    console.log(uri)
    console.log(sender)
    let dest
    if (sender.host == REGIP){
        console.log('Reg Originated')
        dest = `sip:${uri.user}@${TRUNKIP}`; 
        opts = {} 
    } else if (sender.host == TRUNKIP){
        console.log('Trunk Originated')
        dest = `sip:${uri.user}@${REGHOST}`;
        opts = {auth: { username: sender.user, password: "pwpwpw" }} 
    }
    console.log(dest)
    srf.createB2BUA(req, res, dest, opts)
    .then(({uas, uac}) => {
      console.log('call connected');
      // when one side terminates, hang up the other
      uas.on('destroy', () => { uac.destroy(); });
      uac.on('destroy', () => { uas.destroy(); });
    })
    .catch((err) => {
      console.log(`call failed to connect: ${err}`);
    });
});

srf.connect({
    host: '127.0.0.1',
    port: 9022,
    secret: 'cymru'
});



// API Server
const app = express()
app.use(express.json());
app.post('/add/:id', function (request, response) {
    numbers[request.params.id] = request.body
    register(srf, REGHOST, request.params.id, request.body.password, 3600)
    response.send('ok ' + request.params.id)
})

app.post('/remove/:id', function (request, response) {
    register(srf, REGHOST, request.params.id, request.body.password, 0)
    delete numbers[request.params.id]
    response.send('ok ' + request.params.id)
})

app.listen(WEBPORT, () => {
  console.log(`API listening on port ${WEBPORT}`)
})
