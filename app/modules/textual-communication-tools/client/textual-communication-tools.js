window.addEventListener('load', () => registerModule('textualCommunicationTools'));

Template.textualCommunicationTools.onCreated(() => {
  messagesModule.init();
});

Template.textualCommunicationTools.helpers({
  guest: () => Meteor.user()?.profile.guest,
  show: () => Session.get('console'),
});
