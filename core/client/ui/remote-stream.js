const maxAttempt = 10;
const delayBetweenAttempt = 2000; // in ms

const removeAllFullScreenElement = ignoredElement => {
  document.querySelectorAll('.stream .fullscreen').forEach(stream => {
    if (stream.parentElement !== ignoredElement) stream.classList.remove('fullscreen');
  });
  document.querySelectorAll('.js-fullscreen-close').forEach(elem => {
    elem.classList.remove('visible');
  });
};

const updatePhaserMouseInputState = () => {
  const hasStreamInFullScreen = document.querySelectorAll('.stream .fullscreen').length;
  game.scene.getScene('WorldScene')?.enableMouse(!hasStreamInFullScreen);
};

const checkMediaAvailable = (template, type) => {
  const { remoteUser } = template.data;
  if (!remoteUser._id) {
    log(`Missing user id in template data`);
    return;
  }

  const remoteUserIsNear = peer.remoteStreamsByUsers.get().find(usr => usr._id === remoteUser._id);
  if (!remoteUserIsNear) {
    log(`Stop retry to get ${remoteUser.name}'s ${type}, ${remoteUser.name} is too far`);
    return;
  }

  const source = type === streamTypes.screen ? remoteUser.screen?.srcObject : remoteUser.main?.srcObject;
  if (source) {
    template.firstNode.srcObject = source;
    template.firstNode.play().catch(() => {
      error(`unable to player remote user's media: playback interrupted (${remoteUser._id}) : ${template.attempt}`);
      setTimeout(() => checkMediaAvailable(template, type), delayBetweenAttempt);
    });
  } else if (template.attempt < maxAttempt) {
    template.attempt++;
    log(`Tried to get ${remoteUser.name}'s ${type} and failed, attempt : ${template.attempt}`);
    setTimeout(() => checkMediaAvailable(template, type), delayBetweenAttempt);
  } else {
    error(`unable to get user's ${type}`);
  }
};

Template.webcam.onRendered(function () {
  this.attempt = 1;
  checkMediaAvailable(this, 'video-audio');
});

Template.webcam.onDestroyed(function () {
  destroyVideoSource(this.find('video'));
});

Template.screenshare.onRendered(function () {
  this.attempt = 1;
  checkMediaAvailable(this, 'screen');
});

Template.screenshare.onDestroyed(function () {
  destroyVideoSource(this.find('video'));
});

Template.remoteStream.onDestroyed(() => {
  if (!isModalOpen()) game.scene.getScene('WorldScene')?.enableMouse(true);
});

Template.remoteStream.onRendered(function () {
  const avatarDomElement = this.firstNode.querySelector('.avatar');
  if (!avatarDomElement) return;

  avatarDomElement.onerror = event => {
    if (Meteor.settings.public.avatarFallback && event.target.src !== Meteor.settings.public.avatarFallback) {
      event.target.src = Meteor.settings.public.avatarFallback;
    } else {
      // No camera svg icon
      event.target.src = 'data:image/svg+xml;base64, PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgo8c3ZnIHhtbG5zOmlua3NjYXBlPSJodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy9uYW1lc3BhY2VzL2lua3NjYXBlIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHhtbG5zOm5zMT0iaHR0cDovL3NvemkuYmFpZXJvdWdlLmZyIiB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIiB4bWxuczpzb2RpcG9kaT0iaHR0cDovL3NvZGlwb2RpLnNvdXJjZWZvcmdlLm5ldC9EVEQvc29kaXBvZGktMC5kdGQiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgaWQ9InN2ZzI5OTYiIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB2ZXJzaW9uPSIxLjEiIGlua3NjYXBlOnZlcnNpb249IjAuOTEgcjEzNzI1Ij4KICA8ZyBpZD0ibGF5ZXIxIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMzEwLjI5IC01MjIuNjUpIj4KICAgIDxwYXRoIGlkPSJyZWN0MzQ5MS0xLTEiIHN0eWxlPSJmaWxsOiMwMDAwMDAiIGQ9Im0zNzIuMDUgNTU4LjQyYy0wLjU5ODkxIDAtMC43NzQ0MSAwLjQ1OTQ3LTEuMDUyOCAwLjg4MDEybC00LjU3MzMgNi45MDMxaC01LjU1NjlsOS4xODExIDkuMTgxMWMzLjQ5MS0zLjE1MTYgNy45OTk4LTUuMTQyOCAxMi42ODQtNS4xNDI4IDEwLjExNCAwIDE5LjQ2NyA5LjMxOCAxOS40NjcgMTkuNDMyIDAgNC42ODgzLTIuMDE1NSA5LjE5MjItNS4xNzczIDEyLjY4NGwxMC40NTggMTAuNDU4YzAuMzM3Mi0wLjU5NTIxIDAuNTM1MDEtMS4yNjg0IDAuNTM1MDEtMi4wMDE5di00MC41MzhjMC0yLjI0NjgtMS43OTIxLTQuMDcyOC00LjAzODMtNC4wNzI4aC00LjkwMTJsLTQuNTU2LTYuOTAzMWMtMC4yNzgxNy0wLjQyMDY1LTAuNDcwOTUtMC44ODAxMi0xLjA2OTktMC44ODAxMmgtMjEuMzk5em0tMjcuNDQgNy43ODMyYy0yLjI0NiAwLTQuMDU1NSAxLjgyNi00LjA1NTUgNC4wNzI4djQwLjUzOGMwIDIuMjQ1NSAxLjgwOTQgNC4wNzI4IDQuMDU1NSA0LjA3MjhoNTAuODc2bC02Ljg1MTMtNi44NTEzYy0xLjg4OTggMC42NzM2OC0zLjg4MjggMS4wNTI4LTUuOTAyMSAxLjA1MjgtMTAuMTE0IDAtMTkuMzk4LTkuMzAwOC0xOS4zOTgtMTkuNDE1IDAtMi4wMTk0IDAuMzYxODMtNC4wMTM4IDEuMDM1NC01LjkwMjFsLTE3LjU2OC0xNy41NjhoLTIuMTkxOHptMy4zODI1IDkuMDk0OGgwLjYyMTI4YzAuOTM1MzQgMCAxLjY3NCAwLjc1NTg2IDEuNjc0IDEuNjkxM3YyNS4zMzRjMCAwLjkzNTI5LTAuNzM4NzkgMS42OTEyLTEuNjc0IDEuNjkxMmgtMC42MjEyOGMtMC45MzUwNiAwLTEuNjkxMi0wLjc1NjAyLTEuNjkxMi0xLjY5MTJ2LTI1LjMzNGMwLTAuOTM1NDUgMC43NTYxMy0xLjY5MTMgMS42OTEyLTEuNjkxM3ptMzQuNzQgMC4wMTcxYy0zLjU1ODYgMC02LjgwNjUgMS4yOTY4LTkuMzAxOCAzLjQ1MTVsMS43OTQ4IDEuNzk0OGMwLjk0MTE5LTAuNzEzMjMgMS45Nzk0LTEuMjc4NyAzLjA3MTgtMS41ODc3IDAuMzQ3MTUtMC4xMDc5MSAwLjcxMzQ1LTAuMTY0NjggMS4wNy0wLjIyNDM3bC0wLjAxNzEtMC4wMTcxYzEuMDY5OC0wLjE4MDcgMi4xNzI4LTAuMTY3NTUgMy4yNDQ0IDAgMC41ODIxOCAwLjIwNTU0IDAuOTE2ODQgMC40NTQ5OSAwLjUzNDk2IDAuODExMTMtMC42NTM5NiAwLjM2NDA0LTEuNDA4MyAwLjU4MTI0LTIuMDUzNiAwLjk4MzY2LTEuMjQyMSAwLjY2MjE0LTIuMzYxMyAxLjU1NTYtMy4zMTM1IDIuNTg4Nmw5Ljk3NDkgOS45NTc3YzAuMzAxNTgtMS4zNTY4IDEuNTAwNi0yLjM2NDMgMi45NTExLTIuMzY0MyAxLjY3OTYgMCAzLjA1NDYgMS4zNDA3IDMuMDU0NiAzLjAyMDEgMCAxLjQ1NTYtMS4wMjk4IDIuNjU0OC0yLjM5ODggMi45NTExbDIuMjk1MyAyLjI5NTJjMi4xMzk3LTIuNTAzOSAzLjQzNDItNS43NTIxIDMuNDM0Mi05LjMwMTggMC03LjkxMTUtNi40MzAxLTE0LjM1OC0xNC4zNDEtMTQuMzU4em0tMTQuMTY5IDEyLjY1Yy0wLjA2NTkgMC41NTk1My0wLjEwMzQ5IDEuMTMxNC0wLjEwMzQ5IDEuNzA4NSAwIDcuOTExNSA2LjM2MDQgMTQuMzI0IDE0LjI3MiAxNC4zMjQgMC41OTQ0OSAwIDEuMTg0Ny0wLjAzMzEgMS43NjAzLTAuMTAzNTRsLTEwLjAyNy0xMC4wMjdjMC4wOTI2IDAuNTYxNDEgMC4yMTM1IDEuMTE4OCAwLjM2MjM4IDEuNjc0IDAuMDE5MyAwLjI5MTE1LTAuMjM4MDcgMC41MzY2Mi0wLjUxNzczIDAuNTUyMjUtMC4zNzM4MS0wLjEzMTc3LTAuNTgzNzItMC40MjEzMS0wLjgyODM2LTAuNzA3NTktMS4zNDM2LTEuNS0yLjI3NTMtMy4yMjUyLTIuNTg4Ni01LjA5MWwtMi4zMjk4LTIuMzI5OHoiLz4KICAgIDxwYXRoIGlkPSJwYXRoNDMyMC03IiBzdHlsZT0iYmxvY2stcHJvZ3Jlc3Npb246dGI7dGV4dC1pbmRlbnQ6MDtjb2xvcjojMDAwMDAwO3RleHQtdHJhbnNmb3JtOm5vbmU7ZmlsbDojZDM0ODM0IiBkPSJtMzc0LjI5IDUyMi42NWMtMzUuMjg2IDAtNjQuMDA5IDI4LjcyMy02NC4wMDkgNjQuMDA5czI4LjcyMyA2My45OTEgNjQuMDA5IDYzLjk5MSA2My45OTEtMjguNzA1IDYzLjk5MS02My45OTEtMjguNzA1LTY0LjAwOS02My45OTEtNjQuMDA5em0wIDkuOTU3N2MyOS45MTQgMCA1NC4wNTEgMjQuMTM3IDU0LjA1MSA1NC4wNTEgMCAxMy45NjEtNS4yNjA3IDI2LjY2Mi0xMy45MSAzNi4yNDFsLTc2LjQtNzYuNGM5LjU3ODktOC42NDg5IDIyLjI5OC0xMy44OTIgMzYuMjU4LTEzLjg5MnptLTQwLjE0MSAxNy44MSA3Ni4zODIgNzYuNGMtOS41Nzg4IDguNjQ4OS0yMi4yOCAxMy44OTItMzYuMjQxIDEzLjg5Mi0yOS45MTQgMC01NC4wNjgtMjQuMTM3LTU0LjA2OC01NC4wNTEgMC0xMy45NjUgNS4yNzM0LTI2LjY2MSAxMy45MjctMzYuMjQxeiIvPgogIDwvZz4KICA8bWV0YWRhdGE+CiAgICA8cmRmOlJERj4KICAgICAgPGNjOldvcms+CiAgICAgICAgPGRjOmZvcm1hdD5pbWFnZS9zdmcreG1sPC9kYzpmb3JtYXQ+CiAgICAgICAgPGRjOnR5cGUgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIvPgogICAgICAgIDxjYzpsaWNlbnNlIHJkZjpyZXNvdXJjZT0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbGljZW5zZXMvcHVibGljZG9tYWluLyIvPgogICAgICAgIDxkYzpwdWJsaXNoZXI+CiAgICAgICAgICA8Y2M6QWdlbnQgcmRmOmFib3V0PSJodHRwOi8vb3BlbmNsaXBhcnQub3JnLyI+CiAgICAgICAgICAgIDxkYzp0aXRsZT5PcGVuY2xpcGFydDwvZGM6dGl0bGU+CiAgICAgICAgICA8L2NjOkFnZW50PgogICAgICAgIDwvZGM6cHVibGlzaGVyPgogICAgICA8L2NjOldvcms+CiAgICAgIDxjYzpMaWNlbnNlIHJkZjphYm91dD0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbGljZW5zZXMvcHVibGljZG9tYWluLyI+CiAgICAgICAgPGNjOnBlcm1pdHMgcmRmOnJlc291cmNlPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyNSZXByb2R1Y3Rpb24iLz4KICAgICAgICA8Y2M6cGVybWl0cyByZGY6cmVzb3VyY2U9Imh0dHA6Ly9jcmVhdGl2ZWNvbW1vbnMub3JnL25zI0Rpc3RyaWJ1dGlvbiIvPgogICAgICAgIDxjYzpwZXJtaXRzIHJkZjpyZXNvdXJjZT0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjRGVyaXZhdGl2ZVdvcmtzIi8+CiAgICAgIDwvY2M6TGljZW5zZT4KICAgIDwvcmRmOlJERj4KICA8L21ldGFkYXRhPgo8L3N2Zz4=';
    }
  };
});

Template.remoteStream.helpers({
  mediaState() {
    const fields = { 'profile.shareAudio': 1, 'profile.shareVideo': 1 };
    const user = Meteor.users.findOne(this.remoteUser._id, { fields });

    return user?.profile || { shareAudio: false, shareVideo: false };
  },
  hasMainStream() {
    return this.remoteUser.main?.srcObject;
  },
  hasScreenStream() {
    return this.remoteUser.screen?.srcObject;
  },
  state() {
    const fields = { 'profile.userMediaError': 1 };
    const user = Meteor.users.findOne(this.remoteUser._id, { fields });
    if (!user) return 'user-error';
    if (user.profile.userMediaError) return 'media-error';

    return this.remoteUser.waitingCallAnswer ? 'calling' : 'connected';
  },
  name() {
    const fields = { 'profile.username': 1, 'profile.name': 1 };
    const user = Meteor.users.findOne(this.remoteUser._id, { fields });
    if (!user) return 'Guest';

    return user.profile.name || user.username || 'Guest';
  },
  avatar() {
    const fields = { 'profile.avatar': 1, 'profile.name': 1 };
    const user = Meteor.users.findOne(this.remoteUser._id, { fields });
    if (!user) return generateRandomAvatarURLForUser({ _id: 'usr_a', profile: { name: 'Guest', avatar: 'cat' } });

    return generateRandomAvatarURLForUser(user);
  },
});

Template.remoteStream.events({
  'click .stream video, click .stream img'(event) {
    event.preventDefault();

    const { target } = event;
    removeAllFullScreenElement(target);
    target.classList.toggle('fullscreen');
    const closeBtn = target.parentElement.querySelector('.js-fullscreen-close');
    closeBtn?.classList.toggle('visible', target.classList.contains('fullscreen'));

    updatePhaserMouseInputState();
  },
  'click .js-webcam, click .js-screenshare'(event) {
    event.preventDefault();
    const { target } = event;

    removeAllFullScreenElement(target);

    const child = target.querySelector('video, img');
    child?.classList.toggle('fullscreen');
    const closeBtn = target.querySelector('.js-fullscreen-close');
    closeBtn?.classList.toggle('visible', child?.classList.contains('fullscreen'));

    updatePhaserMouseInputState();
  },
});
