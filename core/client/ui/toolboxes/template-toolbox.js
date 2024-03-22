Meteor.subscribe('templates');

Template.templateToolbox.helpers({
  selectedTemplateId() { return Session.get('selectedTemplateId'); },
  templates() {
    return Templates.find().fetch();
  },
});

Template.templateToolbox.onCreated(() => {
  Session.set('templateId', undefined);

  if (!Session.get('selectedTemplateId')) {
    const firstTemplate = Templates.findOne()?._id;
    Session.set('selectedTemplateId', firstTemplate);
  }
});

Template.templateToolbox.onDestroyed(() => {
  Session.set('selectedTemplateId', undefined);
});

Template.templateToolbox.events({
  'change .js-template-select'(event) {
    Session.set('selectedTemplateId', event.currentTarget.value);
  },
  'click .js-use-template'(event) {
    event.preventDefault();
    Session.set('templateId', Session.get('selectedTemplateId'));
    Session.set('selectedTiles', undefined);
  },
  'submit form'(event, tmpl) {
    event.preventDefault();
    const templateId = Session.get('selectedTemplateId');
    const input = tmpl.find('input[name=rename]');
    Templates.update(templateId, { $set: { name: input.value } });
  },
});
