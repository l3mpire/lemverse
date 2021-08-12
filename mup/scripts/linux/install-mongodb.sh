#!/bin/bash

# Remove the lock
set +e
sudo rm /var/lib/dpkg/lock > /dev/null
sudo rm /var/cache/apt/archives/lock > /dev/null
sudo dpkg --configure -a
set -e

# ace: old mongodb 2.6.12, original mup version
# sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
# echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | sudo tee /etc/apt/sources.list.d/mongodb.list
# sudo apt-get update -y
# sudo apt-get install mongodb-org mongodb-org-server mongodb-org-shell mongodb-org-tools -y

# ace: remove all mongo source list
set +e
sudo rm /etc/apt/sources.list.d/mongodb*.list
set -e

# ace: install mongodb 3.2.15, used by meteor 1.6
# sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv EA312927
# echo "deb http://repo.mongodb.org/apt/ubuntu trusty/mongodb-org/3.2 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.2.list
# sudo apt-get update -y
# sudo apt-get install mongodb-org=3.2.15 mongodb-org-server=3.2.15 mongodb-org-shell=3.2.15 mongodb-org-tools=3.2.15 -y

# ace: install mongodb 4.0, used by meteor 1.8 on ubuntu 18
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.0.list
sudo apt-get update -y
sudo apt-get install -y mongodb-org

# Restart mongodb
sudo service mongod stop || :
sudo service mongod start
