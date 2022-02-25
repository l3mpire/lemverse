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

const onKeyPressed = e => {
  if (e.key === 'Escape') closeAndFocusCanvas();
  else if (e.key === 'Enter') Session.set('console', true);
};

const onSubmit = () => {
  const fieldValue = document.querySelector(inputSelector).value;
  if (!fieldValue) {
    closeAndFocusCanvas();
    return;
  }

  const channel = Session.get('messagesChannel');
  if (!channel) {
    lp.notif.error('You have to be in a zone and/or near someone to send a message');
    return;
  }

  messagesModule
    .sendMessage(channel, fieldValue)
    .then(() => {
      userManager.onPeerDataReceived({ emitter: Meteor.userId(), data: fieldValue, type: 'text' });
      clearAndFocusInputField();
    })
    .catch(e => lp.notif.error(e));
};

Template.console.onCreated(function () {
  Session.set('console', false);

  this.autorun(() => {
    const console = Session.get('console');
    if (console) {
      messagesModule.autoSelectChannel();
      clearAndFocusInputField();
    }
  });

  document.addEventListener('keydown', onKeyPressed);
});

Template.console.onDestroyed(() => {
  Session.set('console', false);
  document.removeEventListener('keydown', onKeyPressed);
});

Template.console.events({
  'focus .js-command-input'() { hotkeys.setScope(scopes.form); game.scene.keys.WorldScene.enableKeyboard(false, false); },
  'blur .js-command-input'() { hotkeys.setScope(scopes.player); game.scene.keys.WorldScene.enableKeyboard(true, false); },
  'click .js-button-submit, submit .js-console-form'(event) {
    onSubmit();
    event.preventDefault();
  },
});
