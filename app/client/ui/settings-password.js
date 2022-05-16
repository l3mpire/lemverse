const onSubmit = template => {
  const { currentPassword, newPassword, newPasswordRepeated } = template;

  if (!currentPassword) { lp.notif.error(`Hey! I need your current password...`); return; }
  if (!newPassword) { lp.notif.error(`Hey! Fill your new password... And please not your favorite pet's name ...`); return; }
  if (!newPasswordRepeated) { lp.notif.error(`I need again your new password...`); return; }
  if (newPassword.length < 10 && newPassword.replace(/[a-z]/gm, '').length < 3) { lp.notif.error(`Your password should be more than 9 characters or contains at least 3 special characters (numbers, upper case characters or symbols)`); return; }
  if (newPassword !== newPasswordRepeated) { lp.notif.error(`Please repeat the same new password...`); return; }
  if (currentPassword === newPassword) { lp.notif.error(`New password must be different than current...`); return; }

  Accounts.changePassword(currentPassword, newPassword, err => {
    if (err) { lp.notif.error('Incorrect current password !'); return; }
    lp.notif.success('Your password is now changed successfully !');
  });
};

Template.settingsPassword.onCreated(function () {
  this.currentPassword = undefined;
  this.newPassword = undefined;
  this.newPasswordRepeated = undefined;
});

Template.settingsPassword.events({
  'keyup .js-currentPassword'(e) { Template.instance().currentPassword = e.target.value; },
  'keyup .js-newPassword'(e) { Template.instance().newPassword = e.target.value; },
  'keyup .js-newPasswordRepeated'(e) { Template.instance().newPasswordRepeated = e.target.value; },
  'submit form'(e) {
    e.preventDefault();
    e.stopPropagation();
    onSubmit(Template.instance());
    return false;
  },
});

Template.settingsPassword.helpers({
  currentPassword() { return Template.instance().currentPassword; },
  newPassword() { return Template.instance().newPassword; },
  newPasswordRepeated() { return Template.instance().newPasswordRepeated; },
});
