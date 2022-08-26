import { formatURL } from '../helpers';

const user = () => Meteor.user();

const submit = template => {
  const fields = template.fieldsUpdated;

  Meteor.call('updateUserAccount', fields, error => {
    if (error) {
      lp.notif.error('An error occured while updating account, please try later');
      return;
    }

    const { profile } = user();
    userManager.getControlledCharacter()?.setName(fields.name || profile.name, fields.nameColor || profile.nameColor);
    lp.notif.success('Account updated');
    template.hasUpdates.set(false);
    template.fieldsUpdated = {};
  });
};

Template.characterNameColorSelector.helpers({
  nameColors() { return Object.keys(characterNameColors); },
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
});

Template.settingsBasic.events({
  'blur .input'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();
    templateInstance.fieldsUpdated[event.target.name] = event.target.value;
    templateInstance.hasUpdates.set(true);
  },
  'input .js-name-color'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();
    templateInstance.fieldsUpdated.nameColor = event.target.value;
  },
  'submit form'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();
    submit(templateInstance);

    return false;
  },
  'click .cancel'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();
    templateInstance.hasUpdates.set(false);
    templateInstance.fieldsUpdated = {};
  },
});
