Template.formAccount.helpers({
  showLogForm() { FlowRouter.watchPathChange(); return FlowRouter.current().queryParams.mode === 'login'; },
});
