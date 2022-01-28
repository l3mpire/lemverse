Template.messagesListMessage.helpers({
  user() { return Meteor.users.findOne(this.message.createdBy)?.profile.name || '[removed]'; },
  text() { return this.message.text; },
  date() { return this.message.createdAt.toDateString(); },
  time() { return this.message.createdAt.toLocaleTimeString(); },
});

Template.messagesList.onCreated(function () {
  this.autorun(() => {
    document.querySelector('.messages-list')?.scrollIntoView();
    const messages = Messages.find({}, { fields: { createdBy: 1 } }).fetch();
    const userIds = messages.map(message => message.createdBy).filter(Boolean);
    if (userIds?.length) this.subscribe('usernames', userIds);
  });
});

Template.messagesList.helpers({
  messages() { return Messages.find({}, { sort: { createdAt: -1 } }).fetch(); },
});
