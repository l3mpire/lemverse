Session.setDefault('retryTimeDuration', 0);
const updateRetryTimeDuration = () => Session.set('retryTimeDuration', moment(Meteor.status().retryTime).diff());

Template.layout.onRendered(() => {
  $(document).ready(() => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://${Meteor.settings.public.meet.serverURL}/external_api.js`;
    $('head').append(script);
  });
});

let retryTimeDurationInterval;
Tracker.autorun(() => {
  const { status } = Meteor.status();
  if (FlowRouter.current()?.path === '/editor') Meteor.subscribe('selfUser', this.userId);

  Meteor.clearInterval(retryTimeDurationInterval);
  if (status !== 'waiting') Session.set('retryTimeDuration', 0);
  else {
    updateRetryTimeDuration();
    retryTimeDurationInterval = Meteor.setInterval(updateRetryTimeDuration, 1000);
  }
});

Template.onlineStatus.helpers({
  disconnectedStatus() { return ['waiting', 'offline']; },
  status() {
    return Meteor.status();
  },
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
