const Phaser = require('phaser');

userProximitySensor = {
  nearUsers: {},
  nearDistance: Meteor.settings.public.character.sensorNearDistance,
  farDistance: Meteor.settings.public.character.sensorFarDistance,
  onProximityStarted: undefined,
  onProximityEnded: undefined,

  checkDistances(user, otherUsers) {
    otherUsers.forEach(otherUser => this.checkDistance(user, otherUser));
  },

  checkDistance(user, otherUser) {
    if (user._id === otherUser._id) return;
    if (otherUser?.profile?.guest) return;

    const distance = this.distance(user, otherUser);
    if (distance < this.nearDistance) this.addNearUser(otherUser);
    else if (distance > this.farDistance) this.removeNearUser(otherUser);
  },

  distance(user, otherUser) {
    const { x: userX, y: userY } = user.profile;
    const { x, y } = otherUser.profile;

    // eslint-disable-next-line new-cap
    return Phaser.Math.Distance.Between(x, y, userX, userY);
  },

  addNearUser(user) {
    const userAlreadyNear = this.isUserNear(user);
    this.nearUsers[user._id] = user;
    if (this.onProximityStarted && !userAlreadyNear) this.onProximityStarted(user);
  },

  removeNearUser(user) {
    if (!this.isUserNear(user)) return;

    delete this.nearUsers[user._id];
    if (this.onProximityEnded) this.onProximityEnded(user);
  },

  callProximityStartedForAllNearUsers() {
    if (this.onProximityStarted) _.each(this.nearUsers, user => this.onProximityStarted(user));
  },

  callProximityEndedForAllNearUsers() {
    if (this.onProximityEnded) _.each(this.nearUsers, user => this.onProximityEnded(user));
    this.nearUsers = {};
  },

  isUserNear(user) {
    return this.nearUsers[user._id] !== undefined;
  },

  isNearSomeone() {
    return this.nearUsersCount() > 0;
  },

  nearUsersCount() {
    return Object.keys(this.nearUsers).length;
  },

  nearestUser(user) {
    if (!this.nearUsersCount()) return undefined;

    let nearestUser;
    let nearestDistance = Infinity;
    _.each(this.nearUsers, nearUser => {
      const distance = this.distance(user, nearUser);
      if (distance < nearestDistance) {
        nearestUser = nearUser;
        nearestDistance = distance;
      }
    });

    return nearestUser;
  },
};
