import { moduleType } from '../../../client/helpers';

window.addEventListener('load', () => {
  registerModules(
    [{ id: 'report', icon: '🚨️', order: 4, label: 'Report', shortcut: 53, closeMenu: true, scope: 'other' }],
    moduleType.RADIAL_MENU,
  );

  const onMenuOptionSelected = e => {
    const { user } = e.detail;

    Session.set('modal', { template: 'report', userId: user._id });
  };

  window.addEventListener(eventTypes.onMenuOptionSelected, onMenuOptionSelected);
});

function buildMessage(text, level, reason, reported, messageId) {
  let messageText = '';
  if (messageId) {
    const message = Messages.findOne(messageId);
    messageText = `\nMessage: ${messageId}
\`\`\`${message.text}\`\`\`
Channel: ${message.channel}\n\n`;
  }

  return `REPORT LOG - ${Date()}
Level: ${level}

Justification: ${text}

Reason: ${reason}
${messageText}
Reported: ${reported._id} - ${reported.profile.name}`;
}

const sendReport = (channel, text) => {
  let messageId;

  try {
    messageId = messagesModule.sendMessage(channel, text);
    lp.notif.success('Report sent');
  } catch (e) { lp.notif.error(e); }

  return messageId;
};

const onSubmit = (reason, reported, messageId) => {
  if (reported._id === Meteor.userId()) {
    lp.notif.error('You can\'t report yourself');
    return;
  }
  const isAdmin = Meteor.users.findOne(Meteor.userId()).roles?.admin;

  const text = document.querySelector('.js-command-input').value;
  const currentLevel = Meteor.user().profile.levelId;
  if (!text) {
    lp.notif.error('Please enter a message');
    return;
  }
  if (text.length > 1024) {
    lp.notif.error('Message is too long');
    return;
  }
  let admins = Meteor.users.find({ roles: { admin: true } }).fetch();
  if (isAdmin) {
    admins = admins.filter(admin => admin._id !== Meteor.userId());
  }
  if (!admins.length) {
    // Quiting even if the user is an admin because we don't want to create a conversation with himself
    lp.notif.error('No admins found');
    return;
  }
  const adminsLevel = admins.filter(admin => admin.profile.levelId === currentLevel);
  if (adminsLevel.length) {
    admins = adminsLevel;
  }
  const level = Levels.findOne(currentLevel).name;
  const message = buildMessage(text, level, reason, reported, messageId);
  const channel = [...admins.map(admin => admin._id), Meteor.userId()].sort().join(';');

  sendReport(channel, message);

  closeModal('report');
};

Template.report.onCreated(function () {
  this.reason = new ReactiveVar('Non-specified');
});

Template.report.helpers({
  title() {
    const template = Template.instance();
    return `Report user - ${Meteor.users.findOne(template.data.userId)?.profile.name}`;
  },
  reportAllReasons() {
    const reportAllReasons = ['Non-specified', 'Spam', 'Abusive chat', 'Cheating', 'Offensive name', 'Other'];
    return reportAllReasons;
  },
});

Template.report.events({
  'change .js-report-reason-select'(event) {
    Template.instance().reason.set(event.target.value);
  },
  'click .js-button-submit'(event) {
    event.preventDefault();
    event.stopPropagation();
    const template = Template.instance();
    lp.notif.confirm('Report user', `Do you really want to report this ${template.data.messageId ? 'message' : 'user'}?`, () => onSubmit(template.reason.get(), Meteor.users.findOne(template.data.userId), template.data.messageId));
  },
});
