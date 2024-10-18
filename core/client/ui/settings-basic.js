import { formatURL } from '../helpers';

const user = () => Meteor.user();

const submit = template => {
  const fields = template.fieldsUpdated;

  if (!fields.name) {
    lp.notif.error('A name is required');
    return;
  }

  Meteor.call('updateUserAccount', fields, error => {
    if (error) {
      lp.notif.error('An error occured while updating account, please try later');
      return;
    }

    const { profile } = user();
    userManager.getControlledCharacter()?.setName(fields.name || profile.name,
      fields.baseline || profile.baseline, fields.nameColor || profile.nameColor);
    lp.notif.success('Account updated');
    template.hasUpdates.set(false);
    template.fieldsUpdated = {};
  });
};

Template.characterNameColorSelector.helpers({
  website() {
    const { website } = user().profile;
    if (!website) return null;

    return formatURL(website)?.href;
  },
});

Template.settingsBasic.onCreated(function () {
  this.fieldsUpdated = {};
  this.hasUpdates = new ReactiveVar(false);
});

Template.settingsBasic.helpers({
  fieldUpdated() { return Template.instance().hasUpdates.get(); },
  nameColors() { return Object.keys(Meteor.settings.public.character.nameColors || []); },
});

Template.settingsBasic.events({
  'input .input, input .js-name-color'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();
    templateInstance.fieldsUpdated[event.target.name] = event.target.value;
    templateInstance.hasUpdates.set(true);
  },
  'click .submit.button'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();
    submit(templateInstance);
  },
  'click .cancel'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();

    Object.keys(templateInstance.fieldsUpdated).forEach(id => {
      const elem = document.querySelector(`[name=${id}]`);
      elem.value = elem.dataset.oldvalue;
    });

    templateInstance.hasUpdates.set(false);
    templateInstance.fieldsUpdated = {};
  },
});
