import audioManager from '../../../client/audio-manager';
import { randomFloatInRange, canUseLevelFeature } from '../../../lib/misc';

const playPunchAnimation = () => {
  userManager.scene.cameras.main.shake(250, 0.015, 0.02);
  const randomPitchRatio = randomFloatInRange(0.7, 1.5, 1);
  audioManager.playPitched('punch.mp3', randomPitchRatio);
};

const punch = users => {
  if (!users?.length) return;
  playPunchAnimation();

  users.forEach(user => userManager.getCharacter(user._id)?.onDamage());
  peer.sendData(users.map(user => user._id), { type: 'punch', emitter: Meteor.userId() });
  Meteor.call('analyticsKick');
};

window.addEventListener('load', () => {
  window.addEventListener(eventTypes.onPeerDataReceived, e => {
    const { data, userEmitter } = e.detail;
    if (data.type !== 'punch') return;

    if (!userProximitySensor.isUserNear(userEmitter)) return;
    playPunchAnimation();

    userManager.getCharacter(Meteor.userId())?.onDamage();
  });

  hotkeys('x', { scope: scopes.player }, e => {
    const user = Meteor.user({ fields: { _id: 1, 'profile.levelId': 1, roles: 1 } });
    if (!user || !canUseLevelFeature(user, 'punch', true)) return;

    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;

    punch(Object.values(userProximitySensor.nearUsers));
  });
});
