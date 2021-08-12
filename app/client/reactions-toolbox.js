const reactions = ['❤️', '😲', '😢', '🤣', '😡'];

Template.reactionsToolbox.onCreated(() => {
  reactions.forEach((key, idx) => {
    hotkeys((idx + 1).toString(), { keyup: true, scope: 'player' }, event => {
      const user = Meteor.user();
      if (!user) return;

      Meteor.users.update(Meteor.userId(), { [event.type === 'keydown' ? '$set' : '$unset']: { 'profile.reaction': reactions[idx] } });
    });
  });
});

Template.lemverse.onDestroyed(() => {
  reactions.forEach((key, idx) => {
    hotkeys.unbind((idx + 1).toString());
  });
});

Template.reactionsToolbox.helpers({
  reactions,
  isLoading: () => Session.get('loading'),
});

Template.reactionsToolbox.events({
  'mousedown .js-reaction'(event) {
    const { value } = event.target.dataset;
    if (!reactions.includes(value)) return;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.reaction': value } });
  },
  'mouseup .js-reaction'() {
    Meteor.users.update(Meteor.userId(), { $unset: { 'profile.reaction': 1 } });
  },
});
