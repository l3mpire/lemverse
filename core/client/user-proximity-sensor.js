userProximitySensor = {
  nearUsers: {},
  nearDistance: Meteor.settings.public.character.sensorNearDistance,
  farDistance: Meteor.settings.public.character.sensorFarDistance,

  checkDistances(user, otherUsers) {
    otherUsers.forEach(otherUser => this.checkDistance(user, otherUser));
  },

  checkDistance(user, otherUser) {
    if (user._id === otherUser._id) return;

    const distance = this.distance(user, otherUser);
    if (distance < this.nearDistance) this.addNearUser(otherUser);
    else if (distance > this.farDistance) this.removeNearUser(otherUser);
  },

  distance(user, otherUser) {
    const { x: userX, y: userY } = user.profile;
    const { x, y } = otherUser.profile;

    return Math.hypot(x - userX, y - userY);
  },

  addNearUser(user) {
    const userAlreadyNear = this.isUserNear(user);
    this.nearUsers[user._id] = user;

    if (!userAlreadyNear) window.dispatchEvent(new CustomEvent(eventTypes.onUsersComeCloser, { detail: { users: [user] } }));
  },

  removeNearUser(user) {
    if (!this.isUserNear(user)) return;

    delete this.nearUsers[user._id];

    window.dispatchEvent(new CustomEvent(eventTypes.onUsersMovedAway, { detail: { users: [user] } }));
  },

  callProximityStartedForAllNearUsers() {
    const users = Object.values(this.nearUsers);
    if (!users.length) return;

    window.dispatchEvent(new CustomEvent(eventTypes.onUsersComeCloser, { detail: { users } }));
  },

  callProximityEndedForAllNearUsers() {
    const users = Object.values(this.nearUsers);
    if (!users.length) return;

    window.dispatchEvent(new CustomEvent(eventTypes.onUsersMovedAway, { detail: { users } }));
    this.nearUsers = {};
  },

  isUserNear(user) {
    return this.nearUsers[user._id] !== undefined;
  },

  isNearSomeone() {
    return this.nearUsersCount() > 0;
  },

  filterNearUsers(userIds) {
    return Object.keys(this.nearUsers).filter(userId => userIds.includes(userId));
  },

  nearUsersCount() {
    return Object.keys(this.nearUsers).length;
  },

  nearestUser(user) {
    const nearUsers = Object.values(this.nearUsers);
    if (!nearUsers.length) return undefined;

    let nearestDistance = Infinity;
    let nearestUser;

    nearUsers.forEach(nearUser => {
      const distance = this.distance(user, nearUser);
      if (distance > nearestDistance) return;

      nearestUser = nearUser;
      nearestDistance = distance;
    });

    return nearestUser;
  },
};
