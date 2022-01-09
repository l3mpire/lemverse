const dispatchEventToModal = event => document.querySelector('.modal-container').dispatchEvent(event);
const selectedSource = new ReactiveVar();

Template.mediaSource.helpers({
  image() { return Template.instance().data.thumbnail; },
  selected() { return Template.instance().data.id === selectedSource.get(); },
});

Template.mediaSourceSelection.onCreated(function () {
  const { sources } = this.data;
  selectedSource.set(sources[0].id);
});

Template.mediaSourceSelection.onDestroyed(() => {
  dispatchEventToModal(new Event('screen-share-canceled'));
});

Template.mediaSourceSelection.helpers({
  sources() { return Template.instance().data.sources; },
});

Template.mediaSourceSelection.events({
  'click .js-screen-source'(e) { selectedSource.set(e.currentTarget.dataset.id); },
  'click .js-submit'() {
    dispatchEventToModal(new CustomEvent('window-selected', { detail: selectedSource.get() }));
    Session.set('modal', null);
  },
});
