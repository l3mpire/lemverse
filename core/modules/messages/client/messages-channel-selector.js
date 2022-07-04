const show = () => Session.get('console') && !Session.get('quests');

const allChannels = () => {
  if (!show()) return [];

  const user = Meteor.user({ fields: { 'profile.x': 1, 'profile.y': 1, 'profile.levelId': 1 } });
  if (!user) return [];

  const sortedZones = zones.currentZones(user).map(zone => ({ channel: zone._id, name: `📍 ${zone.name}`, priority: 1 }));

  const nearUsersIds = nearUserIdsToString();
  let nearUsersChannel;
  if (nearUsersIds.length) nearUsersChannel = { channel: nearUsersIds, name: '👥 Near users', priority: 3 };

  const level = Levels.findOne(user.profile.levelId);
  const levelChannel = { channel: level._id, name: `🗺️ ${(level.name || 'Level')}`, priority: 2 };

  return [...sortedZones, nearUsersChannel, levelChannel].filter(Boolean);
};

Template.messagesChannelSelector.onCreated(function () {
  this.channels = new ReactiveVar([]);

  const refreshChannelList = () => {
    if (!show()) return;
    this.channels.set(allChannels());
  };

  window.addEventListener(eventTypes.onUsersComeCloser, refreshChannelList);
  window.addEventListener(eventTypes.onUsersMovedAway, refreshChannelList);

  this.autorun(() => {
    if (!show()) return;
    Tracker.nonreactive(refreshChannelList);
  });
});

Template.messagesChannelSelector.events({
  'click .js-channel-selector'(event) {
    event.preventDefault();
    event.stopPropagation();

    const { channelId } = event.currentTarget.dataset;
    messagesModule.changeMessagesChannel(channelId);
  },
});

Template.messagesChannelSelector.helpers({
  active() { return Session.get('messagesChannel') === this.channel; },
  channels() {
    return Template.instance().channels.get().sort((a, b) => {
      if (a.priority > b.priority) return -1;

      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  },
  show() { return show(); },
});
