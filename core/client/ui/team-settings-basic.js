const submit = template => {
  const fields = template.fieldsUpdated;

  Meteor.call('updateTeam', fields, error => {
    if (error) {
      lp.notif.error('An error occured while updating team, please try later');
      return;
    }

    lp.notif.success('Team updated');
    template.hasUpdates.set(false);
    template.fieldsUpdated = {};
  });
};

Template.teamSettingsBasic.onCreated(function () {
  this.guildId = Meteor.user().guildId;
  this.fieldsUpdated = {};
  this.hasUpdates = new ReactiveVar(false);

  this.subscribe('guilds', [this.guildId]);
});

Template.teamSettingsBasic.helpers({
  fieldUpdated() { return Template.instance().hasUpdates.get(); },
  team() { return Guilds.findOne(Template.instance().guildId); },
});

Template.teamSettingsBasic.events({
  'input .input'(event, templateInstance) {
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
