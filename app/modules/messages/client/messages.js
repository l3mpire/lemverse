messagesModule = {
  handleMessagesSubscribe: undefined,

  init(template) {
    const onZoneEntered = event => {
      const { zone } = event.detail;
      if (this.handleMessagesSubscribe) this.handleMessagesSubscribe.stop();
      if (zone) this.handleMessagesSubscribe = template.subscribe('messages', zone._id);
    };
    const onZoneLeaved = () => this.handleMessagesSubscribe?.stop();

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

    Messages.insert({ _id: Messages.id(), zoneId: zone._id, text: message, createdAt: new Date(), createdBy: Meteor.userId() });
    return true;
  },

  sendMessageToNearUsers() { return false; },

  postUpdate() {},

  update() {},

  destroy() {},
};
