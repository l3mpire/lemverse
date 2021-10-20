Template.userList.helpers({
  guestsCount() { return Meteor.users.find({ 'profile.guest': { $exists: true } }).count(); },
  usersCount() { return Meteor.users.find({ 'profile.guest': { $not: true }, status: { $exists: true } }).count(); },
  users() {
    const users = Meteor.users.find({ 'profile.guest': { $not: true }, status: { $exists: true } }, { sort: { 'profile.name': 1 } }).fetch();
    users.map(usr => {
      const zone = Zones.findOne({
        x1: { $lte: usr.profile.x },
        x2: { $gte: usr.profile.x },
        y1: { $lte: usr.profile.y },
        y2: { $gte: usr.profile.y },
      });
      if (zone && zone.name && !zone.hideName) usr.profile.zoneName = zone.name;

      return usr;
    });

    users.sort((a, b) => a.profile.name.toLowerCase().localeCompare(b.profile.name.toLowerCase()));

    return users;
  },
  zones() { return Zones.find({}, { sort: { name: 1 } }).fetch(); },
  isMe() { return this._id === Meteor.userId(); },
  canEditLevel() { return isEditionAllowed(this._id); },
});

Template.userList.events({
  'click .js-close-button'() {
    Session.set('displayUserList', false);
  },
  'click .js-toggle-edition'() {
    Meteor.call('toggleLevelEditionPermission', this._id);
  },
});
