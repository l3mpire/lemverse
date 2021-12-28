const scopeIcons = {
  zone: '📍',
  nearUsers: '👥',
};

const switchScope = template => {
  if (template.currentScope.get() === scopesNotifications.zone) template.currentScope.set(scopesNotifications.nearUsers);
  else template.currentScope.set(scopesNotifications.zone);
};

Template.consoleScopeSelector.onCreated(function () {
  this.currentScope = this.data.scope;
});

Template.consoleScopeSelector.events({
  'click .js-scope-selector'(event) {
    switchScope(Template.instance());
    event.preventDefault();
    event.stopPropagation();
  },
});

Template.consoleScopeSelector.helpers({
  icon() { return scopeIcons[Template.instance().currentScope.get()]; },
});
