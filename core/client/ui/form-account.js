import { toggleUIInputs } from '../helpers';

Template.formAccount.helpers({
  showLogForm() { FlowRouter.watchPathChange(); return FlowRouter.current().queryParams.mode === 'login'; },
  restrictedRegistration() {
    const { permissions } = Meteor.settings.public;

    if (permissions.allowAccountCreation === 'none') return true;
    if (permissions.allowAccountCreation.includes('except:')) {
      const exceptedLevelId = permissions.allowAccountCreation.split(':')[1];
      return Meteor.user({ fields: { 'profile.levelId': 1 } }).profile.levelId === exceptedLevelId;
    }

    return false;
  },
});

Template.formAccount.events({
  'focus input'() { toggleUIInputs(true); },
  'blur input'() { toggleUIInputs(false); },
});
