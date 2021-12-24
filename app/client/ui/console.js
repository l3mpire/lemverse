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
  if (!fieldValue) return;

  sendDataToNearUsers('text', fieldValue, Meteor.userId())
    .then(() => {
      userManager.onPeerDataReceived({ emitter: Meteor.userId(), data: fieldValue, type: 'text' });
      closeAndFocusCanvas();
    })
    .catch(e => {
      if (e.message === 'no-targets') lp.notif.error('You need someone near you to send text');
      else lp.notif.error(e);
    });
};

Template.console.onCreated(() => {
  hotkeys('enter', scopes.player, () => {
    Session.set('console', true);
    clearAndFocusInputField();
  });

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
