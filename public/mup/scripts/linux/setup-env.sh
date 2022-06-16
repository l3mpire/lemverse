#!/bin/bash

sudo mkdir -p /opt/<%= appName %>/
sudo mkdir -p /opt/<%= appName %>/config
sudo mkdir -p /opt/<%= appName %>/tmp
sudo mkdir -p /opt/<%= appName %>/web.browser

sudo chown ${USER} /opt/<%= appName %> -R
sudo chown ${USER} /etc/init
sudo chown ${USER} /etc/

# ace, wait-for-mongo was too old and cause bson not to compile
#sudo npm install -g forever userdown wait-for-mongo node-gyp

# remove old wait-for-mongo that is not working
sudo npm uninstall -g wait-for-mongo

# ace, use the fork that use mongodb 2.2
sudo npm install -g wait-for-mongo-updt node-gyp

sudo ln -sf /opt/nodejs/bin/wait-for-mongo /usr/bin/wait-for-mongo
sudo ln -sf /opt/nodejs/bin/node-gyp /usr/bin/node-gyp

chmod +x /lib/systemd/system/<%= appName %>.sh

sudo systemctl daemon-reload
sudo systemctl enable <%= appName %>

# Creating a non-privileged user
sudo useradd meteoruser || :
