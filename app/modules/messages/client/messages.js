const ignoreChannelAutoSwitch = () => (Session.get('messagesChannel') || '').includes('qst_');

messagesModule = {
  handleMessagesSubscribe: undefined,
  channel: undefined,
  template: undefined,

  init(template) {
    this.template = template;
    this.lastZoneEntered = undefined;

    const onZoneEntered = event => {
      if (ignoreChannelAutoSwitch()) return;

      const { zone } = event.detail;
      this.lastZoneEntered = zone._id;
      this.changeMessagesChannel(zone._id);
    };

    const onZoneLeaved = event => {
      if (ignoreChannelAutoSwitch()) return;

      const { zone } = event.detail;
      if (zone._id !== this.lastZoneEntered) return;

      const nearUsersChannel = computeChannelNameFromNearUsers();
      if (nearUsersChannel.length) this.changeMessagesChannel(nearUsersChannel);
      else this.stopListeningMessagesChannel();

      this.lastZoneEntered = undefined;
    };

    const onUserNear = () => {
      if (ignoreChannelAutoSwitch()) return;

      this.changeMessagesChannel(computeChannelNameFromNearUsers());
    };

    const onUserMovedAway = () => {
      if (ignoreChannelAutoSwitch()) return;

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

  async sendMessage(channel, content) {
    if (content.length >= 4096) throw new Error('The message is too long (> 4096 chars)');

    window.dispatchEvent(new CustomEvent(eventTypes.beforeSendingMessage, { detail: { channel, content } }));
    const message = Messages.insert({ _id: Messages.id(), channel, text: content, createdAt: new Date(), createdBy: Meteor.userId() });
    window.dispatchEvent(new CustomEvent(eventTypes.afterSendingMessage, { detail: { channel, message } }));

    // avoid sending webrtc message when the channel is for a quest
    const isQuestChannel = channel.includes('qst_');
    if (isQuestChannel) return;

    try {
      const func = channel.includes('zon_') ? sendDataToUsersInZone : sendDataToNearUsers;
      await func('text', content, Meteor.userId());
    } catch (err) {
      if (err.message !== 'no-targets') lp.notif.error(err);
    }

    // simulate a message from himself to show a pop-in over user's head
    userManager.onPeerDataReceived({ emitter: Meteor.userId(), data: content, type: 'text' });
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
