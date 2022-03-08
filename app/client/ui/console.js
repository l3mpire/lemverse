const inputSelector = '.console .js-command-input';
const inputFileSelector = '.console .console-file';

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
  document.querySelector(inputFileSelector).value = '';
  hotkeys.setScope(scopes.player);
  game.scene.keys.WorldScene.enableKeyboard(true, false);
};

const onKeyPressed = e => {
  if (e.key === 'Escape') closeAndFocusCanvas();
  else if (e.key === 'Enter') Session.set('console', true);
};

const sendMessage = (channel, text) => {
  let messageId;

  try {
    messageId = messagesModule.sendMessage(channel, text);
    clearAndFocusInputField();
  } catch (e) { lp.notif.error(e); }

  return messageId;
};

const onSubmit = () => {
  const channel = Session.get('messagesChannel');
  if (!channel) {
    lp.notif.error('You have to be in a zone and/or near someone to send a message');
    return;
  }

  const { files } = document.querySelector(inputFileSelector);
  const text = document.querySelector(inputSelector).value;
  if (!text && !files.length) {
    closeAndFocusCanvas();
    return;
  }

  // message without file
  if (!files.length) { sendMessage(channel, text); return; }

  // upload file and send message
  const uploadedFile = Files.insert({
    file: files[0],
    meta: { source: 'user-console', userId: Meteor.userId() },
  }, false);

  uploadedFile.on('end', (error, file) => {
    if (error) lp.notif.error(`Error during file upload: ${error.reason}`);
    else {
      const messageId = sendMessage(channel, text);
      if (messageId) Messages.update(messageId, { $set: { fileId: file._id } });
      else Files.remove(file._id);
    }
  });

  uploadedFile.start();
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
    event.preventDefault();
    event.stopPropagation();
    onSubmit();
  },
});
