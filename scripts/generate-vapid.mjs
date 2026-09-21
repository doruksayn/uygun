import {createECDH} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const pair=createECDH('prime256v1'); pair.generateKeys();
const publicKey=pair.getPublicKey().toString('base64url');
const privateKey=pair.getPrivateKey().toString('base64url');
// Secret stays in an ignored local file. Never print it or commit it.
writeFileSync('.env.push',`VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nVAPID_SUBJECT=https://github.com/doruksayn/uygun\nAPP_ORIGIN=https://doruksayn.github.io\n`,{flag:'wx',mode:0o600});
console.log('Created ignored .env.push. Public key:',publicKey);
