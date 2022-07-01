const emojis = ['👏', '😲', '😢', '🤣', '🙁', '👍', '❤️'];

let lastPosition = { x: 0, y: 0 };

Template.messageReaction.helpers({

  emojis() { return emojis; },
  visible() { return Session.get('messageReaction'); },
  position() {
    const state = Session.get('messageReaction');
    if (!state) return lastPosition;
    lastPosition = { x: state.x, y: state.y };
    return lastPosition;
  },
});

Template.messageReaction.events({
  'click .js-emoji'(event) {
    event.preventDefault();
    event.stopPropagation();
    const { messageId } = Session.get('messageReaction');
    Session.set('messageReaction', undefined);
    Meteor.call('toggleMessageReaction', messageId, event.target.innerText);
  },
});
