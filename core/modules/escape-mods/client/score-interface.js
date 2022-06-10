const timerDuration = 30;

Template.scoreInterface.onCreated(function () {
  this.timeLeft = new ReactiveVar(timerDuration);
  this.showScores = new ReactiveVar(false);
  this.showTimer = new ReactiveVar(true);

  this.timer = setInterval(() => {
    this.timeLeft.set(this.timeLeft.get() - 1);
    if (this.timeLeft.get() > 0) return;

    clearInterval(this.timer);
    this.showScores.set(true);
    this.showTimer.set(false);
  }, 1000);
});

Template.scoreInterface.helpers({
  showScores(event, templateInstance) { return templateInstance.showScores.get(); },
  showTimer(event, templateInstance) { return templateInstance.showTimer.get(); },
  timeLeft(event, templateInstance) { return templateInstance.timeLeft.get(); },
  users() { return Meteor.users.find({ 'profile.escape.score': { $exists: true } }, { sort: { 'profile.escape.score': -1 } }).fetch(); },
});
