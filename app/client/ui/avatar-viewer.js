const getImage = id => Characters.findOne(id);

Template.avatarViewer.helpers({
  getAppearance() {
    if (!this.user) return [];
    return Object.keys(charactersParts).filter(part => this.user.profile[part]).map(part => getImage(this.user.profile[part]));
  },
});

Template.avatarViewer.events({
  'click .js-show-user-profile'(e) {
    Session.set('modal', { template: 'profile', userId: this.user._id });
    e.preventDefault();
    e.stopPropagation();
  },
});
