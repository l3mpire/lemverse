Template.levelTemplateList.onCreated(function () {
  this.subscribe('levels');
});

Template.levelTemplateList.helpers({
  levels() { return Levels.find({ template: true, hide: { $exists: false } }).fetch(); },
});
