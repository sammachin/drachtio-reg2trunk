const Srf = require('drachtio-srf');
const srf = new Srf();
const parseUri = require('drachtio-sip').parser.parseUri;
const express = require('express')

//Todo Move these to env 
const WEBPORT = 3000
const REGHOST = "default.jbsip.sammachin.com"
const REGIP = "192.168.1.12"
const TRUNKIP = "192.168.1.163"
const TRUNKTRANSPORT = 'udp'
const REGTRANSPORT = "udp"
const LOCAL_IP = "192.168.1.10"
const LOCAL_PORT = "10222"

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
        console.log('Reg Originated')
        dest = `sip:${uri.user}@${TRUNKIP};transport=${TRUNKTRANSPORT}`; 
        opts = {} 
    } else if (sender.host == TRUNKIP){
        console.log('Trunk Originated')
        dest = `sip:${uri.user}@${REGHOST}`;
        console.log(dest)
        opts = {auth: { username: sender.user, password: "pwpwpw" }} 
    } else {
      console.log(`Unknown request ${uri}`)
      res.send(406, 'I dont know you')
    }
    if (dest != undefined){
      srf.createB2BUA(req, res, dest, opts)
      .then(({uas, uac}) => {
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
