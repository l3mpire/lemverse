Template.editorMenu.events({
  'click .js-menu-editor'(e) { Session.set('editorMenu', e.currentTarget.dataset.type); },
});
