const hideMenu = event => {
  if (event.repeat) return;
  event.preventDefault();

  const editToolbox = document.querySelector('.edit-toolbox');
  editToolbox.classList.toggle('minimize');
};
hotkeys('h', { scope: 'editor-menu' }, hideMenu);
hotkeys('h', { scope: 'tileset-toolbox' }, hideMenu); // TODO: Remove this once editor UI is validated

hotkeys('shift+1', { scope: 'editor-menu' }, () => { Session.set('editor', 1); });
hotkeys('shift+2', { scope: 'editor-menu' }, () => { Session.set('editor', 2); });
// TODO: Remove this once editor UI is validated
hotkeys('shift+1', { scope: 'tileset-toolbox' }, () => { Session.set('editor', 1); });
hotkeys('shift+2', { scope: 'tileset-toolbox' }, () => { Session.set('editor', 2); });

Template.editToolbox.onCreated(() => {
  if (!Session.get('editor')) Session.set('editor', 1);
  hotkeys.setScope('editor-menu');
});

Template.editToolbox.onDestroyed(() => {
  hotkeys.setScope('player');
});

Template.editToolbox.events({
  'click .js-menus-select'(e) {
    Session.set('editor', e.currentTarget.dataset.menu);
  },
  'click .js-menus-shrink'() {
    const editToolbox = document.querySelector('.edit-toolbox');
    editToolbox.classList.toggle('minimize');
  },
});
