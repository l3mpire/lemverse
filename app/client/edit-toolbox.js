const hideMenu = event => {
  if (event.repeat) return;
  event.preventDefault();

  const editToolbox = document.querySelector('.edit-toolbox');
  editToolbox.classList.toggle('minimize');
};

hotkeys('h', { scope: 'editor-menu' }, hideMenu);
hotkeys('shift+1', { scope: 'editor-menu' }, () => Session.set('editorSelectedMenu', 1));
hotkeys('shift+2', { scope: 'editor-menu' }, () => Session.set('editorSelectedMenu', 2));
hotkeys('shift+3', { scope: 'editor-menu' }, () => Session.set('editorSelectedMenu', 3));

Template.editToolbox.onCreated(() => {
  if (!Session.get('editorSelectedMenu')) Session.set('editorSelectedMenu', 1);
  hotkeys.setScope('editor-menu');
  game.scene.keys.EditorScene.scene.wake();
});

Template.editToolbox.onDestroyed(() => {
  hotkeys.setScope('player');
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
