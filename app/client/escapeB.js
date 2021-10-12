Template.escapeB.onCreated(() => {
  Meteor.call('currentLevel', (err, result) => {
    if (err) return;
    Session.set('currentLevel', result);
  });
});

Template.escapeB.helpers({
  iframe() {
    return FlowRouter.current().queryParams.n;
  },
});

Template.escapeB.events({
  'click .js-key-code'(e) {
    const { lock, code } = e.currentTarget.dataset;
    const lockString = `lock${lock}`;

    const currentLevel = Session.get('currentLevel');
    if (code === 'VALIDATE') {
      if (Session.get(lockString) === currentLevel.metadata[lockString].code) {
        // Success
        Meteor.call('enlightenZone', currentLevel.metadata[lockString].zone);
      } else {
        // Failure
        document.querySelector('#redLed').classList.remove('hide');
        setTimeout(() => {
          document.querySelector('#redLed').classList.add('hide');
        }, 3000);
      }
      Session.set(lockString, '');
    } else if (code === 'CLEAR') {
      Session.set(lockString, '');
    } else {
      Session.set(lockString, `${Session.get(lockString) || ''}${code}`);
    }
  },
  'click .js-activate-switch'(e) {
    const { zone } = e.currentTarget.dataset;
    if (!zone) return;
    Meteor.call('toggleZone', zone);
  },
});
