Template.editorMenu.events({
  'click .js-menu-editor'(event) { Session.set('editorMenu', event.currentTarget.dataset.type); },
});
