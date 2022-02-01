messagesModule = {
  handleMessagesSubscribe: undefined,
  channel: undefined,
  template: undefined,

  init(template) {
    this.template = template;
    this.lastZoneEntered = undefined;

    const onZoneEntered = event => {
      const { zone } = event.detail;
      this.lastZoneEntered = zone._id;
      this.changeMessagesChannel(zone._id);
    };
    const onZoneLeaved = event => {
      const { zone } = event.detail;
      if (zone._id !== this.lastZoneEntered) return;

      const nearUsersChannel = computeChannelNameFromNearUsers();
      if (nearUsersChannel.length) this.changeMessagesChannel(nearUsersChannel);
      else this.stopListeningMessagesChannel();

      this.lastZoneEntered = undefined;
    };
    const onUserNear = () => {
      this.changeMessagesChannel(computeChannelNameFromNearUsers());
    };
    const onUserMovedAway = () => {
      const channel = computeChannelNameFromNearUsers();
      if (!channel.length && this.lastZoneEntered) this.changeMessagesChannel(this.lastZoneEntered);
      else if (channel.length) this.changeMessagesChannel(channel);
      else this.stopListeningMessagesChannel();
    };

    window.addEventListener(eventTypes.onZoneEntered, onZoneEntered);
    window.addEventListener(eventTypes.onZoneLeaved, onZoneLeaved);
    window.addEventListener(eventTypes.onUserNear, onUserNear);
    window.addEventListener(eventTypes.onUserMovedAway, onUserMovedAway);
  },

  autoSelectChannel() {
    if (userProximitySensor.isNearSomeone()) this.changeMessagesChannel(computeChannelNameFromNearUsers());
    else if (zones.activeZone) this.changeMessagesChannel(zones.activeZone._id);
  },

  changeMessagesChannel(channel) {
    if (!channel || channel === this.channel) return;

    this.stopListeningMessagesChannel();
    this.handleMessagesSubscribe = this.template.subscribe('messages', channel);
    this.channel = channel;
    Session.set('messagesChannel', channel); // set console in the new channel
  },

  sendMessage(channel, message) {
    const isZoneTargeted = channel.includes('zon_');
    if (message.length >= 4096) return Promise.reject(new Error('The message is too long (> 4096 chars)'));

    return new Promise(resolve => {
      // insert message
      Messages.insert({ _id: Messages.id(), channel, text: message, createdAt: new Date(), createdBy: Meteor.userId() });

      // send message using webrtc (note we can ignore webrtc and use meteor observers too)
      const func = isZoneTargeted ? sendDataToUsersInZone : sendDataToNearUsers;
      func('text', message, Meteor.userId())
        .then(() => userManager.onPeerDataReceived({ emitter: Meteor.userId(), data: message, type: 'text' }))
        .catch(e => {
          if (e.message !== 'no-targets') lp.notif.error(e);
        });

      resolve();
    });
  },

  stopListeningMessagesChannel() {
    this.channel = undefined;
    this.handleMessagesSubscribe?.stop();
    Session.set('messagesChannel', undefined);
  },

  postUpdate() {},

  update() {},

  destroy() {},
};
