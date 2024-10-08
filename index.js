const Srf = require('drachtio-srf');
const srf = new Srf();
const parseUri = require('drachtio-sip').parser.parseUri;
const express = require('express')

const WEBPORT = process.env.R2T_WEBPORT
const REGHOST = process.env.R2T_REGHOST
const REGIP = process.env.R2T_REGIP
const TRUNKIP = process.env.R2T_TRUNKIP
const TRUNKTRANSPORT = process.env.R2T_TRUNKTRANSPORT
const REGTRANSPORT = process.env.R2T_REGTRANSPORT
const LOCAL_IP = process.env.R2T_LOCALIP
const LOCAL_PORT = process.env.R2T_LOCALPORT

let numbers = {}

// Drachtio
function register(srf, server, username, password, expiry) {
  const uri = `sip:${server};transport=${REGTRANSPORT}`;
  const proxy = `sip:${server};transport=${REGTRANSPORT}`;
  const contact = `<sip:${username}@${LOCAL_IP}:${LOCAL_PORT};transport=${REGTRANSPORT}>`;
  if (username in numbers){
    console.log(`Sending To -> ${uri} from ${contact}`);
    srf.request(uri, {
      method: 'REGISTER',
      proxy,
      headers: {
        'Contact': contact,
        'From': `<sip:${username}@${server}>`,
        'To': `<sip:${username}@${server}>`,
        'Expires': expiry,
        'Allow': 'INVITE, ACK, BYE, CANCEL, OPTIONS, MESSAGE, INFO, UPDATE, REGISTER, REFER, NOTIFY'
      },
      auth: {
        username: username,
        password: password
      }
    }, (err, req) => {
      if (err) {console.log(`Error ${err}`)};
      req.on('response', (res) => {
        if (res.status === 200) {
          if (expiry != 0) {let timeout = (res.headers.expires-5)*1000
            console.log(`${username} Registered OK, timer ${timeout}`)
            setTimeout(register, timeout, srf, server, username, password, expiry)}
        }
        else {
            console.log(`REGISTER was rejected after auth with ${res.status}`);
        }

      });
    });
  }
}

srf.on('connect', (err, hostport) => {
  console.log(`connected to a drachtio server listening on: ${hostport}`);
});

srf.invite((req, res) => {
    const uri = parseUri(req.uri);
    const sender = parseUri(req.getParsedHeader('From').uri)
    let dest
    if (req.source_address == REGIP){
        console.log(`Reg originated call from ${sender.user} to ${uri.user}` )
        dest = `sip:${uri.user}@${TRUNKIP};transport=${TRUNKTRANSPORT}`;
        opts = {}
        console.log(req.get('Contact'))
    } else if (req.source_address == TRUNKIP){
        console.log(`Trunk Originated call from ${sender.user} to ${uri.user}`)
        if (sender.user in numbers){
          dest = `sip:${uri.user}@${REGHOST}:5060;transport=${REGTRANSPORT}`;
          opts = {auth: { username: sender.user, password: numbers[sender.user]['password'] }}
        } else {
          console.error(`ERROR ${sender.user} is not registered`)
          res.send(406, 'Number not registered')
        }
    } else {
      console.log(`Unknown Source IP ${req.source_address}`)
      res.send(406, 'I dont know you')
    }
    if (dest != undefined){
      srf.createB2BUA(req, res, dest, opts)
      .then(({uas, uac}) => {
        console.log(uas)
        // when one side terminates, hang up the other
        uas.on('destroy', () => { uac.destroy(); });
        uac.on('destroy', () => { uas.destroy(); });
      })
      .catch((err) => {
        console.log(`call failed to connect: ${err}`);
      });
    }

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

app.get('/list', function (request, response){
  response.send(JSON.stringify(Object.keys(numbers)))
})

app.listen(WEBPORT, () => {
  console.log(`API listening on port ${WEBPORT}`)
})
