const show = () => Session.get('console') && !Session.get('quests');

const allChannels = () => {
  if (!show()) return [];

  const user = Meteor.user();
  if (!user) return [];

  const sortedZones = zones.currentZones(user).map(zone => ({ _id: zone._id, name: zone.name }));

  const nearUsersIds = nearUserIdsToString();
  let nearUsersChannel;
  if (nearUsersIds.length) nearUsersChannel = { _id: nearUsersIds, name: 'Near users' };

  const level = Levels.findOne(user.profile.levelId);
  const levelChannel = { _id: level._id, name: level.name || 'Level' };

  return [...sortedZones, nearUsersChannel, levelChannel].filter(Boolean);
};

Template.messagesChannelSelector.events({
  'click .js-channel-selector'(event) {
    event.preventDefault();
    event.stopPropagation();

    const { channelId } = event.currentTarget.dataset;
    messagesModule.changeMessagesChannel(channelId);
  },
});

Template.messagesChannelSelector.helpers({
  show() { return show(); },
  channels() { return allChannels().sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())); },
  active() { return Session.get('messagesChannel') === this._id; },
});
