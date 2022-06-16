const getImage = id => Characters.findOne(id);

Template.avatarViewer.helpers({
  online() { return this.user?.status.online; },
  username() { return this.user?.profile.name; },
  getAppearance() {
    if (!this.user) return [];
    return Object.keys(charactersParts).filter(part => this.user.profile[part]).map(part => getImage(this.user.profile[part]));
  },
});

Template.avatarViewer.events({
  'click .js-show-user-profile'(event) {
    event.preventDefault();
    event.stopPropagation();
    Session.set('modal', { template: 'profile', userId: this.user._id });
  },
});
