const reactions = ['❤️', '😲', '😢', '🤣', '😡'];

Template.reactionsToolbox.onCreated(() => {
  reactions.forEach((key, idx) => {
    hotkeys((idx + 1).toString(), { keyup: true, scope: scopes.player }, event => {
      const user = Meteor.user();
      if (!user) return;

      Meteor.users.update(Meteor.userId(), { [event.type === 'keydown' ? '$set' : '$unset']: { 'profile.reaction': reactions[idx] } });
    });
  });
});

Template.lemverse.onDestroyed(() => {
  reactions.forEach((key, idx) => hotkeys.unbind((idx + 1).toString(), scopes.player));
});

Template.reactionsToolbox.helpers({
  reactions,
  isLoading: () => Session.get('loading'),
});

Template.reactionsToolbox.events({
  'touchstart .js-reaction, mousedown .js-reaction'(e) {
    e.preventDefault();
    e.stopPropagation();
    const { value } = e.target.dataset;
    if (!reactions.includes(value)) return;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.reaction': value } });
  },
  'touchend .js-reaction, mouseup .js-reaction'(e) {
    e.preventDefault();
    e.stopPropagation();
    Meteor.users.update(Meteor.userId(), { $unset: { 'profile.reaction': 1 } });
  },
});
