#!/bin/bash

sudo unlink /opt/<%= appName %>
sudo ln -sf /opt/<%= masterName %> /opt/<%= appName %>

chmod +x /lib/systemd/system/<%= appName %>.sh

sudo systemctl daemon-reload
sudo systemctl enable <%= appName %>