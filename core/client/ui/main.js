import { nearestDuration, filesURL } from '../helpers';

document.title = Meteor.settings.public.lp.product;
document.getElementById('favicon').setAttribute('href', `${filesURL}favicon.png`);
document.getElementById('favicon-16').setAttribute('href', `${filesURL}favicon16x16.png`);
document.getElementById('favicon-32').setAttribute('href', `${filesURL}favicon32x32.png`);
document.getElementById('apple-touch-icon').setAttribute('href', `${filesURL}appletouchicon.png`);

Session.setDefault('retryTimeDuration', 0);
const updateRetryTimeDuration = () => Session.set('retryTimeDuration', moment(Meteor.status().retryTime).diff());

Template.layout.helpers({
  settings() { return Meteor.settings; },
});

let retryTimeDurationInterval;
Tracker.autorun(() => {
  const { status } = Meteor.status();
  Meteor.subscribe('selfUser', this.userId);

  Meteor.clearInterval(retryTimeDurationInterval);
  if (status !== 'waiting') Session.set('retryTimeDuration', 0);
  else {
    updateRetryTimeDuration();
    retryTimeDurationInterval = Meteor.setInterval(updateRetryTimeDuration, 1000);
  }
});

Template.onlineStatus.helpers({
  disconnectedStatus() { return ['waiting', 'offline']; },
  status() { return Meteor.status(); },
  retryIn() {
    const [hour, minutes, seconds] = nearestDuration(Session.get('retryTimeDuration')).split(':');
    let retryIn = '';
    if (+hour) retryIn += `${+hour}h`;
    if (+hour || +minutes) retryIn += `${+minutes}mn`;
    if (+seconds) retryIn += `${+seconds}s`;
    return retryIn;
  },
});

Template.onlineStatus.events({
  'click .retry'() {
    Meteor.reconnect();
  },
});

remote = cmd => {
  Meteor.call('remote', cmd, (e, r) => {
    // eslint-disable-next-line no-console
    if (e) { console.error(e); return; }
    try { r = JSON.parse(r); } catch {}
    // eslint-disable-next-line no-console
    console[(_.isArray(r) && r.length ? 'table' : 'log')](r);
  });
};

Template.reloadStatus.events({
  'click .js-reload'() { Session.set('reload', true); return false; },
});

// block hot code push if in production
if (lp.isProduction()) {
  Reload._onMigrate(retry => {
    Session.set('needReload', true);

    if (Session.get('reload')) {
      Session.set('needReload', false);
      Session.set('reload', false);
      return [true];
    }

    Tracker.autorun(() => {
      if (Session.get('reload')) {
        retry();
      }
    });
    return [false];
  });
}
