Template.formAccount.helpers({
  showLogForm() { FlowRouter.watchPathChange(); return FlowRouter.current().queryParams.mode === 'login'; },
  restrictedRegistration() {
    const { permissions } = Meteor.settings.public;
    if (!permissions) return false;

    if (!permissions.contactURL?.length) return false;
    if (permissions.allowAccountCreation === 'all') return false;

    if (permissions.allowAccountCreation === 'none') return true;
    if (permissions.allowAccountCreation.includes('except:')) {
      const exceptedLevelId = permissions.allowAccountCreation.split(':')[1];
      return Meteor.user().profile.levelId === exceptedLevelId;
    }

    return false;
  },
});
