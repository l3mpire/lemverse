const keydownListener = (id, e) => {
  if (e.code === 'Escape' && id) Session.set(id, null);
};

Template.modal.onCreated(function () {
  this.keydownListener = keydownListener.bind(this, this.data.id);

  Tracker.autorun(() => {
    const open = Session.get(this.data.id);
    if (open) document.addEventListener('keydown', this.keydownListener);
    else document.removeEventListener('keydown', this.keydownListener);
  });
});

Template.modal.events({
  'click .js-modal-close, click .js-modal-background'() {
    Session.set(Template.instance().data.id, null);
  },
});

Template.modal.helpers({
  open() { return Session.get(Template.instance().data.id); },
});
