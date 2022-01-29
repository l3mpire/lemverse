const getImage = id => Characters.findOne(id);

Template.avatarViewer.helpers({
  getAppearance() {
    if (!this.user) return [];
    return Object.keys(charactersParts).filter(part => this.user.profile[part]).map(part => getImage(this.user.profile[part]));
  },
});
