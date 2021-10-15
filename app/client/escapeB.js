Template.escapeB.onCreated(() => {
  Meteor.call('currentLevel', (err, result) => {
    if (err) return;
    Session.set('currentLevel', result);
  });
});

const computeDuration = () => {
  const currentLevel = Session.get('currentLevel');
  const start = currentLevel?.metadata?.start || 0;
  const end = currentLevel?.metadata?.end || 0;
  const res = ((end - start) / (1000 * 60)) | 0;
  console.log('computeDuration: ', res);
  return res;
};

Template.escapeB.helpers({
  iframe() {
    return FlowRouter.current().queryParams.n;
  },
  duration() {
    return computeDuration();
  },
  isLoaded() {
    const currentLevel = Session.get('currentLevel');
    return !!currentLevel?.metadata;
  },
  youWin() {
    return computeDuration() < 60; // 60 minutes
  },
});

Template.escapeB.events({
  'click .js-key-code'(e) {
    const { lock, code } = e.currentTarget.dataset;
    const lockString = `lock${lock}`;
    beep();

    const currentLevel = Session.get('currentLevel');
    if (code === 'VALIDATE') {
      if (Session.get(lockString) === currentLevel.metadata[lockString].code) {
        // Success
        Meteor.call('enlightenZone', currentLevel.metadata[lockString].zone);
        unlock();
      } else {
        // Failure
        buzz();
        document.querySelector('#redLed').classList.remove('hide');
        setTimeout(() => {
          document.querySelector('#redLed').classList.add('hide');
        }, 3000);
      }
      Session.set(lockString, '');
    } else if (code === 'CLEAR') {
      Session.set(lockString, '');
    } else {
      Session.set(lockString, `${Session.get(lockString) || ''}${code}`);
    }
  },
  'click .js-activate-switch'(e) {
    const { zone } = e.currentTarget.dataset;
    if (!zone) return;
    click();
    Meteor.call('toggleZone', zone);
  },
});

Template.registerHelper('isEscapeLevel', () => {
  const level = Levels.findOne(Meteor.user()?.profile?.levelId);
  if (!level) return false;
  return level.metadata?.escape;
});
Template.registerHelper('displayEscapeTimer', () => {
  const level = Session.get('currentLevel');
  if (!level) return false;
  return FlowRouter.current()?.path === '/' && level.metadata?.escape && level.metadata?.start && !level.metadata?.end;
});

//
// escapeTimer
//

const timer = {
  start: undefined,
  minutesDelay: undefined,
  end: undefined,

  digits: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],

  init() {
    this.end = this.start + this.minutesDelay * 1000 * 60;
    const $digit = $('.digit');

    // Ugly....
    this.hour = [$($digit[0]), $($digit[1])];
    this.min = [$($digit[2]), $($digit[3])];
    this.sec = [$($digit[4]), $($digit[5])];

    this.drawInterval(this.drawSecond, time => 1000 - time[3]);

    this.drawInterval(this.drawMinute, time => 60000 - time[2] * 1000 - time[3]);

    this.drawInterval(this.drawHour, time => (60 - time[1]) * 60000 - time[2] * 1000 - time[3]);
  },

  getTimeArray() {
    const deadline = new Date(this.end - Date.now());
    return [deadline.getHours(), deadline.getMinutes(), deadline.getSeconds(), deadline.getMilliseconds()];
  },

  drawInterval(func, timeCallback) {
    const time = this.getTimeArray();

    func.call(this, time);

    const that = this;
    setTimeout(() => {
      that.drawInterval(func, timeCallback);
    }, timeCallback(time));
  },

  drawHour(time) { this.drawDigits(this.hour, time[0]); },

  drawMinute(time) { this.drawDigits(this.min, time[1]); },

  drawSecond(time) { this.drawDigits(this.sec, time[2]); },

  drawDigits(digits, digit) {
    const ten = Math.floor(digit / 10);
    const one = Math.floor(digit % 10);

    digits[0].attr('class', `digit ${this.digits[ten]}`);
    digits[1].attr('class', `digit ${this.digits[one]}`);
  },

};

Template.escapeTimer.onRendered(function () {
  this.autorun(() => {
    if (!Meteor.user()) return;
    const currentLevel = Levels.findOne(Meteor.user().profile.levelId);
    if (!currentLevel) return;
    timer.start = currentLevel.metadata.start;
    timer.minutesDelay = 60;
    timer.init();
  });
});
