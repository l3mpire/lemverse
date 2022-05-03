window.addEventListener('load', () => registerModule('textualCommunicationTools'));

Template.textualCommunicationTools.helpers({
  guest: () => Meteor.user()?.profile.guest,
  show: () => Session.get('console'),
});
