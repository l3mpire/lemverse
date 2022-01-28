const inputSelector = '.console .js-command-input';

const clearAndFocusInputField = () => {
  Tracker.afterFlush(() => {
    const field = document.querySelector(inputSelector);
    if (!field) return;
    field.value = '';
    field.focus();
  });
};

const closeAndFocusCanvas = () => {
  Session.set('console', false);
  document.querySelector(inputSelector)?.blur();
  hotkeys.setScope(scopes.player);
  game.scene.keys.WorldScene.enableKeyboard(true, false);
};

const onSubmit = scope => {
  const fieldValue = document.querySelector(inputSelector).value;
  if (!fieldValue) {
    closeAndFocusCanvas();
    return;
  }

  messagesModule.sendMessage(scope, fieldValue);

  // webrtc event
  const func = scope === scopesNotifications.nearUsers ? sendDataToNearUsers : sendDataToUsersInZone;
  func('text', fieldValue, Meteor.userId())
    .then(() => {
      userManager.onPeerDataReceived({ emitter: Meteor.userId(), data: fieldValue, type: 'text' });
      closeAndFocusCanvas();
    })
    .catch(e => {
      if (e.message === 'no-targets' && scope === scopesNotifications.nearUsers) lp.notif.error('You need someone near you to send text');
      else lp.notif.error(e);
    });
};

const autoSetScope = template => {
  if (userProximitySensor.isNearSomeone()) template.scope.set(scopesNotifications.nearUsers);
  else template.scope.set(scopesNotifications.zone);
};

Template.console.onCreated(function () {
  this.scope = new ReactiveVar(scopesNotifications.nearUsers);

  this.autorun(() => {
    const console = Session.get('console');
    if (console) {
      autoSetScope(this);
      clearAndFocusInputField();
    }
  });

  hotkeys('enter', scopes.player, () => Session.set('console', true));
  hotkeys('escape', scopes.player, () => closeAndFocusCanvas());
});

Template.console.onDestroyed(() => {
  hotkeys.unbind('escape', scopes.form);
  hotkeys.unbind('enter', scopes.form);
});

Template.console.events({
  'focus .js-command-input'() { hotkeys.setScope(scopes.form); game.scene.keys.WorldScene.enableKeyboard(false, false); },
  'blur .js-command-input'() { hotkeys.setScope(scopes.player); game.scene.keys.WorldScene.enableKeyboard(true, false); },
  'keydown .js-command-input'(event) { if (event.which === 27) { closeAndFocusCanvas(); event.preventDefault(); } },
  'click .js-button-submit, submit .js-console-form'(event) {
    onSubmit(Template.instance().scope.get());
    event.preventDefault();
  },
});

Template.console.helpers({
  scope() { return Template.instance().scope; },
});
