messagesModule = {
  handleMessagesSubscribe: undefined,
  channel: undefined,
  template: undefined,

  init(template) {
    this.template = template;

    const onZoneEntered = event => {
      const { zone } = event.detail;
      this.changeMessagesChannel(zone._id);
    };
    const onZoneLeaved = () => this.stopListeningMessagesChannel();

    window.addEventListener('onZoneEntered', onZoneEntered);
    window.addEventListener('onZoneLeaved', onZoneLeaved);
  },

  sendMessage(scope, message) {
    if (!message?.length) {
      lp.notif.error('Invalid message');
      return;
    }

    if (scope === scopesNotifications.zone) this.sendMessageToCurrentZone(message);
    else if (scope === scopesNotifications.nearUsers) this.sendMessageToNearUsers(message);
    else throw new Error('Scope not implemented');
  },

  sendMessageToCurrentZone(message) {
    const zone = zones.currentZone();
    if (!zone) {
      lp.notif.error('Messages are only available in zones');
      return false;
    }

    return this.sendMessageToChannel(zone._id, message);
  },

  sendMessageToNearUsers(message) {
    const { nearUsers } = userProximitySensor;
    const userIds = Object.keys(nearUsers);

    if (!userIds.length) {
      lp.notif.error('You need someone near you to send a message');
      return false;
    }

    return this.sendMessageToChannel(userIds.join(';'), message);
  },

  changeMessagesChannel(channel) {
    if (!channel || channel === this.channel) return;

    this.stopListeningMessagesChannel();
    this.handleMessagesSubscribe = this.template.subscribe('messages', channel);
    this.channel = channel;
  },

  sendMessageToChannel(channel, message) {
    Messages.insert({ _id: Messages.id(), channel, text: message, createdAt: new Date(), createdBy: Meteor.userId() });
    return true;
  },

  stopListeningMessagesChannel() {
    this.channel = undefined;
    this.handleMessagesSubscribe?.stop();
  },

  postUpdate() {},

  update() {},

  destroy() {},
};
