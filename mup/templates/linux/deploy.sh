#!/bin/bash

# utilities
gyp_rebuild_inside_node_modules () {
  for npmModule in ./*; do
    cd $npmModule

    isBinaryModule="no"
    # recursively rebuild npm modules inside node_modules
    check_for_binary_modules () {
      if [ -f binding.gyp ]; then
        isBinaryModule="yes"
      fi

      if [ $isBinaryModule != "yes" ]; then
        if [ -d ./node_modules ]; then
          cd ./node_modules
          for module in ./*; do
            cd $module
            check_for_binary_modules
            cd ..
          done
          cd ../
        fi
      fi
    }

    check_for_binary_modules

    if [ $isBinaryModule = "yes" ]; then
      echo " > $npmModule: npm install due to binary npm modules"
      rm -rf node_modules
      if [ -f binding.gyp ]; then
        sudo npm install --unsafe-perm
        sudo node-gyp rebuild || :
      else
        sudo npm install --unsafe-perm
      fi
    fi

    cd ..
  done
}

rebuild_binary_npm_modules () {
  for package in ./*; do
    if [ -d $package/node_modules ]; then
      cd $package/node_modules
        gyp_rebuild_inside_node_modules
      cd ../../
    elif [ -d $package/main/node_module ]; then
      cd $package/node_modules
        gyp_rebuild_inside_node_modules
      cd ../../../
    fi
  done
}

revert_app (){
  if [[ -d old_app ]]; then
    sudo rm -rf app
    sudo mv old_app app
    sudo systemctl stop <%= appName %> || :
    sudo systemctl start <%= appName %> || :

    echo "Latest deployment failed! Reverted back to the previous version." 1>&2
    exit 1
  else
    echo "App did not pick up! Please check app logs." 1>&2
    exit 1
  fi
}


# logic
set -e

TMP_DIR=/opt/<%= appName %>/tmp
BUNDLE_DIR=${TMP_DIR}/bundle

cd ${TMP_DIR}
sudo chmod -R +x *
#sudo chown -R meteoruser ${BUNDLE_DIR}

# rebuilding fibers
cd ${BUNDLE_DIR}/programs/server

if [ -d ./npm ]; then
  cd npm
  rebuild_binary_npm_modules
  cd ../
fi

if [ -d ./node_modules ]; then
  cd ./node_modules
  gyp_rebuild_inside_node_modules
  cd ../
fi

if [ -f package.json ]; then
  # support for 0.9
  sudo npm install --unsafe-perm
else
  # support for older versions
  sudo npm install fibers
  sudo npm install bcrypt
fi

cd /opt/<%= appName %>/

# remove old app, if it exists
if [ -d old_app ]; then
  sudo rm -rf old_app
fi

if [[ -d web.browser ]]
then
  sudo cp tmp/bundle/programs/web.browser/*.{css,js,map} web.browser || :
  sudo cp tmp/bundle/programs/web.browser.legacy/*.{css,js,map} web.browser || :
fi

## slow
sudo cp -a tmp/bundle tmp/app

## backup current version
if [[ -d app ]]; then
  ## fast
  sudo mv app old_app
fi

## fast
sudo mv tmp/app app

#wait and check
echo "Waiting for MongoDB to initialize. (5 minutes)"
# doesn't work with spaces in variables (Facebook Pixel)
#export $(cat /lib/systemd/system/<%= appName %>.env | xargs)
set -a
. /lib/systemd/system/<%= appName %>.env
set +a
wait-for-mongo ${MONGO_URL} 300000

# restart app
sudo systemctl stop <%= appName %> || :
sudo systemctl start <%= appName %> || :

echo "Waiting for <%= deployCheckWaitTime %> seconds while app is booting up"
#sleep <%= deployCheckWaitTime %> # PN

echo "Checking is app booted or not?"
#curl localhost:${PORT} || revert_app # PN

i="0"
ok="0"
while [ $i -lt <%= deployCheckWaitTime %> ]; do
  if curl --connect-timeout 1 localhost:${PORT}; then
    ok="1"
    break
  fi
  i=$[$i+1]; sleep 1
done
if [ $ok -eq 0 ]; then echo "curl failed"; revert_app; fi

# chown to support dumping heapdump and etc
sudo chown -R meteoruser app
