const messageMaxLength = 4096;

const ignoreChannelAutoSwitch = () => !Session.get('console') || (Session.get('messagesChannel') || '').includes('qst_');

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

    const onZoneLeft = event => {
      if (ignoreChannelAutoSwitch()) return;

      const { zone } = event.detail;
      if (zone._id !== this.lastZoneEntered) return;

      const nearUsersChannel = nearUserIdsToString();
      if (nearUsersChannel.length) this.changeMessagesChannel(nearUsersChannel);
      else this.stopListeningMessagesChannel();

      this.lastZoneEntered = undefined;
    };

    const onUserNear = () => {
      if (ignoreChannelAutoSwitch()) return;

      this.changeMessagesChannel(nearUserIdsToString());
    };

    const onUserMovedAway = () => {
      if (ignoreChannelAutoSwitch()) return;

      const channel = nearUserIdsToString();
      if (!channel.length && this.lastZoneEntered) this.changeMessagesChannel(this.lastZoneEntered);
      else if (channel.length) this.changeMessagesChannel(channel);
      else this.stopListeningMessagesChannel();
    };

    window.addEventListener(eventTypes.onZoneEntered, onZoneEntered);
    window.addEventListener(eventTypes.onZoneLeft, onZoneLeft);
    window.addEventListener(eventTypes.onUserNear, onUserNear);
    window.addEventListener(eventTypes.onUserMovedAway, onUserMovedAway);
  },

  autoSelectChannel() {
    if (userProximitySensor.isNearSomeone()) this.changeMessagesChannel(nearUserIdsToString());
    else if (zones.activeZone) this.changeMessagesChannel(zones.activeZone._id);
  },

  changeMessagesChannel(channel) {
    if (!channel || channel === this.channel) return;

    this.stopListeningMessagesChannel();
    this.handleMessagesSubscribe = this.template.subscribe('messages', channel);
    this.channel = channel;
    Session.set('messagesChannel', channel); // set console in the new channel
    this.markChannelAsRead(channel);
  },

  markChannelAsRead(channel) {
    if (channel.includes('zon_')) {
      Meteor.call('updateZoneLastSeenDate', channel, () => {
        const zone = Zones.findOne(channel);
        if (zone) zones.destroyNewContentIndicator(zone);
      });
    } else if (channel.includes('qst_')) {
      const notification = Notifications.findOne({ $or: [{ questId: channel }, { channelId: channel }], userId: Meteor.userId() });
      if (notification && !notification.read) Notifications.update(notification._id, { $set: { read: true } });
    }
  },

  async sendWebRTCMessage(channel, content) {
    try {
      let showPopInOverEmitter = true;
      if (channel.includes('zon_')) await sendDataToUsersInZone('text', content, Meteor.userId());
      else {
        const userIds = userProximitySensor.filterNearUsers(channel.split(';'));
        showPopInOverEmitter = !!userIds.length;
        await sendDataToUsers('text', content, Meteor.userId(), userIds);
      }

      // simulate a message from himself to show a pop-in over user's head
      if (showPopInOverEmitter) userManager.onPeerDataReceived({ emitter: Meteor.userId(), data: content, type: 'text' });
    } catch (err) {
      if (err.message !== 'no-targets') lp.notif.error(err);
    }
  },

  sendMessage(channel, content, file) {
    if (content.length >= messageMaxLength) throw new Error(`The message is too long (> ${messageMaxLength} chars)`);
    content = lp.purify(content);
    if (!content.length && !file) throw new Error(`Invalid content`);

    window.dispatchEvent(new CustomEvent(eventTypes.beforeSendingMessage, { detail: { channel, content } }));

    let messageData = { _id: Messages.id(), channel, text: content, createdAt: new Date(), createdBy: Meteor.userId() };
    if (file) messageData = { ...messageData, fileId: file._id };
    const messageId = Messages.insert(messageData);

    window.dispatchEvent(new CustomEvent(eventTypes.afterSendingMessage, { detail: { channel, messageId } }));

    this.markChannelAsRead(channel);
    if (!channel.includes('qst_') && content.length) this.sendWebRTCMessage(channel, content);

    return messageId;
  },

  stopListeningMessagesChannel() {
    this.channel = undefined;
    this.handleMessagesSubscribe?.stop();
    Session.set('messagesChannel', undefined);
  },
};
