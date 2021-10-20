Template.modal.events({
  'click .js-modal-close, click .js-modal-background'() {
    Session.set(Template.instance().data.id, null);
  },
});

Template.modal.helpers({
  isOpen() { return Session.get(Template.instance().data.id); },
});
