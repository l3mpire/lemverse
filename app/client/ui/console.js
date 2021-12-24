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

const formatInput = input => {
  let output = input;
  const url = formatURL(input);
  if (url) output = `🔗 <a href="${url}" target="_blank">${url.origin}</a>`;
  else throw new Error('not-link');

  return `<p>${output}</p>`;
};

const onSubmit = () => {
  const fieldValue = document.querySelector(inputSelector).value;
  if (!fieldValue) return;

  let formatedInput;
  try {
    formatedInput = formatInput(fieldValue);
  } catch (e) {
    lp.notif.error(`Only links are allowed for the moment`);
    return;
  }

  sendDataToNearUsers('text', formatedInput, Meteor.userId())
    .then(() => {
      characterPopIns.createOrUpdate(
        'link-pop-in',
        formatedInput,
        { target: userManager.player, className: 'tooltip with-arrow fade-in' },
      );

      window.setTimeout(() => characterPopIns.destroyPopIn('link-pop-in'), 4000);
    })
    .catch(e => {
      if (e.message === 'no-targets') lp.notif.error('You need someone near you to send text');
      else lp.notif.error(e);
    });

  closeAndFocusCanvas();
};

Template.console.onCreated(() => {
  hotkeys('enter', 'player', () => {
    Session.set('console', true);
    clearAndFocusInputField();
  });

  hotkeys('escape', 'player', () => closeAndFocusCanvas());
});

Template.console.onDestroyed(() => {
  hotkeys.unbind('escape', scopes.form);
  hotkeys.unbind('enter', scopes.form);
});

Template.console.events({
  'focus .js-command-input'() { hotkeys.setScope(scopes.form); game.scene.keys.WorldScene.enableKeyboard(false, false); },
  'blur .js-command-input'() { hotkeys.setScope(scopes.player); game.scene.keys.WorldScene.enableKeyboard(true, false); },
  'click .js-button-submit'(event) {
    onSubmit();
    event.preventDefault();
  },
  'submit .js-console-form'(event) {
    onSubmit();
    event.preventDefault();
  },
  'keydown .js-command-input'(event) { if (event.which === 27) { closeAndFocusCanvas(); event.preventDefault(); } },
});
