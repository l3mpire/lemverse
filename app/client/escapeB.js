Template.escapeB.onCreated(() => {
  Meteor.call('currentLevel', (err, result) => {
    if (err) return;
    Session.set('currentLevel', result);
  });
});

const computeDuration = () => {
  const currentLevel = Session.get('currentLevel');
  const start = currentLevel.metadata?.start || 0;
  const end = currentLevel.metadata?.end || 0;
  const res = ((end - start) / (60 * 60)) | 0;
  return res;
};

Template.escapeB.helpers({
  iframe() {
    return FlowRouter.current().queryParams.n;
  },
  duration() {
    computeDuration();
  },
  youWin() {
    const currentLevel = Session.get('currentLevel');
    if (currentLevel.metadata?.end) return false;
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
  const level = Session.get('currentLevel');
  if (!level) return false;
  return level.metadata?.escape;
});

Template.registerHelper('gameStarted', () => {
  const level = Session.get('currentLevel');
  if (!level) return false;
  return level.metadata?.start;
});

Template.registerHelper('isMainRoute', () => FlowRouter.current()?.path === '/');

Template.escapeTimer.onCreated(() => {
  const animationTime = 60 * 60;
  const minutes = 60;

  $(document).ready(() => {
    // timer arguments:
    //   #1 - time of animation in mileseconds,
    //   #2 - days to deadline

    $('#progress-time-fill, #death-group').css({ 'animation-duration': `${animationTime}s` });

    const deadlineAnimation = function () {
      setTimeout(() => {
        $('#designer-arm-grop').css({ 'animation-duration': '1.5s' });
      }, 0);

      setTimeout(() => {
        $('#designer-arm-grop').css({ 'animation-duration': '1s' });
      }, animationTime * 0.3 * 1000);

      setTimeout(() => {
        $('#designer-arm-grop').css({ 'animation-duration': '0.7s' });
      }, animationTime * 0.6 * 1000);

      setTimeout(() => {
        $('#designer-arm-grop').css({ 'animation-duration': '0.3s' });
      }, animationTime * 0.7 * 1000);

      setTimeout(() => {
        $('#designer-arm-grop').css({ 'animation-duration': '0.2s' });
      }, animationTime * 0.85 * 1000);
    };

    function timer(totalTime, deadline) {
      const time = totalTime * 1000;
      const dayDuration = time / deadline;
      let actualDay = deadline;

      // eslint-disable-next-line no-use-before-define
      const interval = setInterval(countTime, dayDuration);

      function countTime() {
        --actualDay;
        $('.deadline-days .day').text(actualDay);

        if (actualDay === 0) {
          clearInterval(interval);
          $('.deadline-days .day').text(deadline);
        }
      }
    }

    const deadlineText = function () {
      const $el = $('.deadline-days');
      const html = `<div class="mask-red"><div class="inner">${$el.html()}</div></div><div class="mask-white"><div class="inner">${$el.html()}</div></div>`;
      $el.html(html);
    };

    deadlineText();

    deadlineAnimation();
    timer(animationTime, minutes);

    setInterval(() => {
      timer(animationTime, minutes);
      deadlineAnimation();
    }, animationTime * 1000);
  });
});
