const invitationURL = levelId => {
  const levelIdWithoutPrefix = levelId.substring(levelId.lastIndexOf('_') + 1);
  const path = FlowRouter.path('invite', { levelId: levelIdWithoutPrefix });

  return `${window.location.protocol}//${window.location.host}${path}`;
};

Template.editorOnboarding.events({
  'submit form'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();
    templateInstance.loading.set(true);

    const { email: { value: email }, levelName: { value: levelName }, levelTemplateId: { value: levelTemplateId } } = event.target;
    Meteor.call('onboardUser', { email, levelName, levelTemplateId }, (error, result) => {
      if (error) { lp.notif.error(error); return; }
      templateInstance.loading.set(false);
      templateInstance.result.set(result);
    });
  },
  'click .js-copy-level-url'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();

    const { levelId } = templateInstance.result.get();
    navigator.clipboard.writeText(invitationURL(levelId)).then(() => lp.notif.success('✂️ URL copied to your clipboard'));
  },
  'click .js-copy-password-url'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();

    const { passwordURL } = templateInstance.result.get();
    navigator.clipboard.writeText(passwordURL).then(() => lp.notif.success('✂️ URL copied to your clipboard'));
  },
});

Template.editorOnboarding.onCreated(function () {
  this.subscribe('levelTemplates');
  this.loading = new ReactiveVar(false);
  this.result = new ReactiveVar();
});

Template.editorOnboarding.helpers({
  label() { return this.label || this.name; },
  templates() { return Levels.find().fetch(); },
  loading() { return Template.instance().loading.get(); },
  passwordURL() { return Template.instance().result.get()?.passwordURL; },
  levelURL() { return Template.instance().result.get()?.levelId; },
});
