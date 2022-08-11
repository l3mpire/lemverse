import audioManager from '../../../client/audio-manager';

const punch = users => {
  if (!users?.length) return;
  userManager.scene.cameras.main.shake(250, 0.015, 0.02);
  audioManager.play('punch.mp3');
  if (Math.random() > 0.95) audioManager.play('punch2.mp3'); // NOSONAR

  users.forEach(user => userManager.takeDamage(userManager.players[user._id]));
  peer.sendData(users.map(user => user._id), { type: 'punch', emitter: Meteor.userId() });
};

window.addEventListener('load', () => {
  window.addEventListener(eventTypes.onPeerDataReceived, e => {
    const { data, userEmitter } = e.detail;
    if (data.type !== 'punch') return;

    if (!userProximitySensor.isUserNear(userEmitter)) return;

    audioManager.play('punch.mp3');
    userManager.scene.cameras.main.shake(250, 0.015, 0.02);
    if (Math.random() > 0.95) audioManager.play('punch2.mp3'); // NOSONAR

    userManager.takeDamage(userManager.players[Meteor.user()._id]);
  });

  hotkeys('x', { scope: scopes.player }, e => {
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;

    punch(Object.values(userProximitySensor.nearUsers));
  });
});
