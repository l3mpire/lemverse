# Deploy in production!

## :dvd: Software requirements

- [Docker](https://www.docker.com/) : packages `docker` and `docker-compose`

## :desktop_computer: Network Requirements

You will need a DNS domain name pointing to your server with a [wildcard DNS record](https://en.wikipedia.org/wiki/Wildcard_DNS_record)
> **Note**
> For free DNS names you can use [Dynu DNS](https://www.dynu.com/)

You will need the used port to be opened on your router and forwarded to your server :
- Port 80 for HTTP
- Port 443 for HTTPS
- Port 9000 for PeerJs

## :globe_with_meridians: Setup reverse proxy

You need to set up a reverse proxy in a docker container to :
 - Redirect `${YOUR_DOMAIN_NAME}` to `app.${YOUR_DOMAIN_NAME}`
 - Redirect HTTP to HTTPS
 - Forward `app.${YOUR_DOMIN_NAME}` to the docker container adding certificates
 - Forward `peer.${YOUR_DOMIN_NAME}` to the docker container adding certificates

you can use (NGINX)[https://www.nginx.com/] and the exemple inside `exemple/docker-compose-prod-certificate/reverse-proxy`, replacing all occurrences of `${YOUR_DOMAIN_NAME}`

## :page_with_curl: Set-up certificates

You will need a SSL certifcate for each subdomain : 
- `${YOUR_DOMAIN_NAME}`
- `app.${YOUR_DOMAIN_NAME}`
- `peer.${YOUR_DOMAIN_NAME}`
> **Note**
> You can manage your cerificates with [Certbot](https://certbot.eff.org/), which uses [Let's Encrypt](https://letsencrypt.org/fr/getting-started/)

Once you have created you certificates and have a path for them you need to : 
- Mount a volume containing the certificates to the reverse-proxy : update `docker-compose.yml` (change only if your path differs from the exemple)
- Point to the certificates in the reverse-proxy configuration: update : `nginx.comf` (change only if your path differs from the exemple)


## :runner: Run lemverse in production 

export your settings.json in the environment variable METEOR_SETTINGS

`export METEOR_SETTINGS="$(cat path/to/settings.json)"`

then execute docker-compose from this folder :

`docker-compose up -d`

