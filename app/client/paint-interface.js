const paintModeDuration = 30;

Template.paintInterface.onCreated(function () {
  this.timeLeft = new ReactiveVar(paintModeDuration);
  this.showScores = new ReactiveVar(false);
  this.showTimer = new ReactiveVar(true);

  this.timer = setInterval(() => {
    this.timeLeft.set(this.timeLeft.get() - 1);
    if (this.timeLeft.get() <= 0) {
      clearInterval(this.timer);
      this.showScores.set(true);
      this.showTimer.set(false);
    }
  }, 1000);
});

Template.paintInterface.helpers({
  showScores() { return Template.instance().showScores.get(); },
  showTimer() { return Template.instance().showTimer.get(); },
  timeLeft() { return Template.instance().timeLeft.get(); },
  users() {
    return Meteor.users.find({ 'profile.escape.score': { $exists: true } }, { sort: { 'profile.escape.score': -1 } }).fetch();
  },
});
