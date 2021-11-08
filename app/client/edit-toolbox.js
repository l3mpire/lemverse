const hideMenu = event => {
  if (event.repeat) return;
  event.preventDefault();

  const editToolbox = document.querySelector('.edit-toolbox');
  editToolbox.classList.toggle('minimize');
};

Template.editToolbox.onCreated(() => {
  hotkeys('h', { scope: scopes.editor }, hideMenu);
  hotkeys('shift+1', { scope: scopes.editor }, () => Session.set('editorSelectedMenu', 1));
  hotkeys('shift+2', { scope: scopes.editor }, () => Session.set('editorSelectedMenu', 2));
  hotkeys('shift+3', { scope: scopes.editor }, () => Session.set('editorSelectedMenu', 3));
  hotkeys('shift+0', { scope: scopes.editor }, event => {
    if (event.repeat) return;
    levelManager.drawTriggers(!levelManager.teleporterGraphics.length);
  });

  hotkeys.setScope(scopes.editor);

  if (!Session.get('editorSelectedMenu')) Session.set('editorSelectedMenu', 1);
  game.scene.keys.EditorScene.scene.wake();
});

Template.editToolbox.onDestroyed(() => {
  hotkeys.unbind('h', scopes.editor);
  hotkeys.unbind('shift+1', scopes.editor);
  hotkeys.unbind('shift+2', scopes.editor);
  hotkeys.unbind('shift+3', scopes.editor);
  hotkeys.unbind('shift+0', scopes.editor);
  hotkeys.setScope(scopes.player);

  game.scene.keys.EditorScene.scene.sleep();
});

Template.editToolbox.events({
  'click .js-menus-select'(e) {
    Session.set('editorSelectedMenu', Number(e.currentTarget.dataset.menu));
  },
  'click .js-menus-shrink'() {
    const editToolbox = document.querySelector('.edit-toolbox');
    editToolbox.classList.toggle('minimize');
  },
});
