
const TRANSPORT = "udp"
const LOCAL_IP = "192.168.1.10"
const LOCAL_PORT = "10222"
let numbers = {}

function register(srf, server, username, password, expiry) {
    const uri = `sip:${server};transport=${TRANSPORT}`;
    const proxy = `sip:${server};transport=${TRANSPORT}`;
    const contact = `<sip:${username}@${LOCAL_IP}:${LOCAL_PORT};transport=${TRANSPORT}>`;
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

module.exports = {
  register, numbers
};
