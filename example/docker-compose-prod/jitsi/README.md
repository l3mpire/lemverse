# init jitsi

inspired from : https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker

Run `bash gen_env.sh` to create env file

Replace `YOURDOMAIN.COM` in `PUBLIC_URL` of file `.env`

Replace `YOURDOMAIN.COM` in `../docker-compose.yml` at JITSI_HOST var
Replace `YOURDOMAIN.COM` in `../docker-compose.yml` at serverURL

Up jitsi with `docker-compose up -d`
