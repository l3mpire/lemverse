import { formatURLs, replaceTextVars } from '../../../client/helpers';
import { currentLevel } from '../../../lib/misc';

const getCurrentChannelName = () => {
  const channel = Session.get('messagesChannel');
  if (!channel) return '-';

  if (channel.includes('zon_')) return Zones.findOne(channel)?.name || 'Zone';
  else if (channel.includes('lvl_')) return currentLevel(Meteor.user())?.name || 'Level';
  else if (channel.includes('qst_')) return '';

  const userIds = channel.split(';');
  const users = Meteor.users.find({ _id: { $in: userIds } }).fetch();
  const userNames = users.map(user => user.profile.name);

  return userNames.join(' & ');
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
  getCurrentChannelName,
  formatDate,
  formatText,
  show,
};
