const Srf = require('drachtio-srf');
const srf = new Srf();
const rtpengine = require('rtpengine-client').Client
const client = new rtpengine();
const parseUri = require('drachtio-sip').parser.parseUri;
const express = require('express')


//Config

const WEBPORT = 3000 //process.env.R2T_WEBPORT
const REGHOST = "192.168.1.2" //process.env.R2T_REGHOST
const REGIP = "192.168.1.2" //process.env.R2T_REGIP
const TRUNKIP = "127.0.0.1" //process.env.R2T_TRUNKIP
const TRUNKPORT = "5061" // process.env.R2T_TRUNKPORT
const TRUNKTRANSPORT = "udp" //process.env.R2T_TRUNKTRANSPORT
const REGTRANSPORT = "udp" //process.env.R2T_REGTRANSPORT
const LOCAL_IP = "192.168.1.151" //process.env.R2T_LOCALIP
const LOCAL_PORT = "5060" // process.env.R2T_LOCALPORT

let numbers = {}


// helper functions

// clean up and free rtpengine resources when either side hangs up
function endCall(dlg1, dlg2, details) {
  [dlg1, dlg2].each((dlg) => {
    dlg.on('destroy', () => {
        console.log("Ending Call")
        (dlg === dlg1 ? dlg2 : dlg1).destroy();
        rtpengine.delete(details);
    });
  });
}

// function returning a Promise that resolves with the SDP to offer A leg in 18x/200 answer
function getSdpA(details, remoteSdp, res) {
  return client.answer(2223, '127.0.0.1', Object.assign(details, {
    'sdp': remoteSdp,
    'to-tag': res.getParsedHeader('To').params.tag
   }))
    .then((response) => {
      if (response.result !== 'ok') throw new Error(`Error calling answer: ${response['error-reason']}`);
      return response.sdp;
   })
}

//SIP Registration
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

  

// handle incoming invite
srf.invite((req, res) => {
  const from = req.getParsedHeader('From');
  const details = {'call-id': req.get('Call-Id'), 'from-tag': from.params.tag};
  const uri = parseUri(req.uri);
  const sender = parseUri(req.getParsedHeader('From').uri)
  let dest
  let codecs
  if (req.source_address == REGIP){
      console.log(`Reg originated call from ${sender.user} to ${uri.user}` )
      codecs = { 'mask': ['PCMA', 'PCMU', 'G722'], 'transcode': ['GSM', 'AMR'] }
      dest = `sip:${uri.user}@${TRUNKIP}:${TRUNKPORT};transport=${TRUNKTRANSPORT}`;
      opts = {}
      console.log(req.get('Contact'))
  } else if (req.source_address == TRUNKIP){
      console.log(`Trunk Originated call from ${sender.user} to ${uri.user}`)
      codecs = { 'mask': ['GSM', 'AMR'], 'transcode': ['PCMA'] }
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
  if (dest != undefined) {
  client.offer(2223, '127.0.0.1', Object.assign(details, {'sdp': req.body, 'codec': codecs }))
    .then((rtpResponse) => {
      if (rtpResponse && rtpResponse.result === 'ok') return rtpResponse.sdp;
      throw new Error('rtpengine failure');
    })
    .then((sdpB) => {
      opts.localSdpB = sdpB
      opts.localSdpA = getSdpA.bind(null, details)
      return srf.createB2BUA(req, res, dest, opts);
    })
    .then(({uas, uac}) => {
      console.log('call connected with media proxy');
      uas.on('destroy', () => {
        console.log('Call ended by A party') 
        uac.destroy();
        client.delete(2223, '127.0.0.1', details);

      });
      uac.on('destroy', () => {
        console.log('Call ended by B party') 
        uas.destroy();
        client.delete(2223, '127.0.0.1', details);

      });
    })
    .catch((err) => {
      console.log(`Error proxying call with media: ${err}`);
    })
  }
});

//Main 
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
