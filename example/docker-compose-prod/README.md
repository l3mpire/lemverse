# Deploy in production!

## Initial setup

Have docker and docker-compose installed on your machine.

To enable the usage of conference room, you will need to have instance of [JITSI](https://jitsi.org/downloads/) running.

follow instruction in jitsi folder to setup jitsi instance

## Run lemverse in production 

Do replace all of `YOURDOMAIN.COM` by your domain name.
Make your domain registra point to your server, for all subdomains:
- `app.YOURDOMAIN.COM` for frontend access
- `jitsi.YOURDOMAIN.COM` for conference room system
- `peer.YOURDOMAIN.COM` for peer to peer audio and video

then do :

`docker-compose up -d`

go to FRONTEND_HOST and enjoy 
