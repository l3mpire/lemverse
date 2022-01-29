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

const onSubmit = () => {
  const fieldValue = document.querySelector(inputSelector).value;
  if (!fieldValue) {
    closeAndFocusCanvas();
    return;
  }

  const channel = Session.get('messagesChannel');
  if (!channel) {
    lp.notif.error('No channel selected to send a message');
    return;
  }

  messagesModule
    .sendMessage(channel, fieldValue)
    .then(() => userManager.onPeerDataReceived({ emitter: Meteor.userId(), data: fieldValue, type: 'text' }))
    .catch(e => lp.notif.error(e));
};

Template.console.onCreated(function () {
  this.autorun(() => {
    const console = Session.get('console');
    if (console) {
      messagesModule.autoSelectChannel();
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
    onSubmit();
    event.preventDefault();
  },
});
