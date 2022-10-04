Template.uiSwitchBox.helpers({
  checked() { return this.checked && !this.disabled; },
});

Template.uiSwitchBox.events({
  'change input'(event, templateInstance) {
    Session.set(templateInstance.data.name, event.currentTarget.checked);
  },
});
