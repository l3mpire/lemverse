import { formatURLs, replaceTextVars } from '../../../client/helpers';
import { currentLevel } from '../../../lib/misc';

const channelIdToChannelName = (channelId, showUserList = false) => {
  const currentUser = Meteor.user({ fields: { 'profile.levelId': 1 } });

  if (!channelId || channelId.includes('lvl_')) {
    return currentLevel(currentUser)?.name || 'Level';
  }

  if (channelId.includes('zon_')) {
    return Zones.findOne(channelId)?.name || 'Zone';
  } else if (channelId.includes('qst_')) {
    return 'Quest';
  }

  const userIds = channelId.split(';');
  if (showUserList) {
    const users = Meteor.users.find({ _id: { $in: userIds } }).fetch();
    const userNames = users.map(user => user.profile.name);

    return userNames.join(' & ');
  }

  if (userIds.length > 2) {
    if (channelId === nearUserIdsToString()) {
      return 'Near users';
    }

    return 'Group talk';
  } else if (userIds.length === 2) {
    const otherUserId = userIds.splice(userIds.indexOf(currentUser._id), 1)[0];
    const otherUser = Meteor.users.findOne(otherUserId, { fields: { 'profile.name': 1, name: 1 } });
    if (!otherUser) {
      return 'Other user & Me';
    }

    return `${otherUser.name || otherUser.profile.name} & Me`;
  }

  return 'Invalid channel';
};

const formatDate = date => {
  const now = new Date();
  if (now.getDate() === date.getDate()) return 'Today';
  if (now.getDate() === date.getDate() - 1) return 'Yesterday';

  return date.toDateString();
};

const formatText = text => {
  let finalText = lp.purify(text);
  finalText = formatURLs(finalText);
  finalText = replaceTextVars(finalText);

  return finalText.replace(/(?:\r\n|\r|\n)/g, '<br>');
};

const show = () => Session.get('messagesUI');

export {
  channelIdToChannelName,
  formatDate,
  formatText,
  show,
};
