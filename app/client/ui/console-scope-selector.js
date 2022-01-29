const channelIcons = {
  none: '❌',
  zone: '📍',
  nearUsers: '👥',
};

const getAllChannels = () => {
  const sortedZones = zones.currentZones(Meteor.user()).map(zone => zone._id);
  const nearUsers = computeChannelNameFromNearUsers();

  return [...sortedZones, nearUsers].filter(Boolean);
};

const selectNextChannel = template => {
  const channels = getAllChannels();
  const channelCount = channels.length;
  if (channelCount === 0) return;

  template.currentChannelIndex += 1;
  if (template.currentChannelIndex >= channelCount) template.currentChannelIndex = 0;
  messagesModule.changeMessagesChannel(channels[template.currentChannelIndex]);
};

const autoBindChannelIndex = (template, channel) => {
  const channels = getAllChannels();
  const channelCount = channels.length;
  if (channelCount === 0) {
    template.currentChannelIndex = 0;
    return;
  }

  const index = channels.findIndex(c => c === channel);
  template.currentChannelIndex = index !== -1 ? index : 0;
};

Template.consoleScopeSelector.onCreated(function () {
  this.currentChannelIndex = 0;

  this.autorun(() => {
    const channel = Session.get('messagesChannel');
    if (!channel) this.currentChannelIndex = 0;
    else autoBindChannelIndex(this, channel);
  });
});

Template.consoleScopeSelector.events({
  'click .js-scope-selector'(event) {
    selectNextChannel(Template.instance());
    event.preventDefault();
    event.stopPropagation();
  },
});

Template.consoleScopeSelector.helpers({
  icon() {
    const channel = Session.get('messagesChannel');
    if (!channel) return channelIcons.none;

    return channel.includes('zon_') ? channelIcons.zone : channelIcons.nearUsers;
  },
});
