/* eslint-disable no-use-before-define */

const getMenuActiveUser = () => {
  const { userId } = Session.get('menu');
  if (!userId) return undefined;

  return Meteor.users.findOne(userId);
};

const lovePhrases = userName => [
  `You are the best ${userName}`,
  `You are gorgeous ${userName}`,
  `Have a good day ${userName}!`,
  `I hope your day is great ${userName}`,
];

const reactionMenuItems = [
  { icon: '🪧', shortcut: 50, action: () => setReaction(Meteor.user().profile.defaultReaction || Meteor.settings.public.defaultReaction), cancel: () => setReaction() },
  { icon: '↩️', shortcut: 49, action: template => buildMenu(mainMenuItems, template.items) },
  { icon: '👏', shortcut: 57, action: () => setReaction('👏'), cancel: () => setReaction() },
  { icon: '😲', shortcut: 56, action: () => setReaction('😲'), cancel: () => setReaction() },
  { icon: '😢', shortcut: 55, action: () => setReaction('😢'), cancel: () => setReaction() },
  { icon: '🤣', shortcut: 54, action: () => setReaction('🤣'), cancel: () => setReaction() },
  { icon: '🙁', shortcut: 53, action: () => setReaction('🙁'), cancel: () => setReaction() },
  { icon: '👍', shortcut: 52, action: () => setReaction('👍'), cancel: () => setReaction() },
  { icon: '❤️', shortcut: 51, action: () => setReaction('❤️'), cancel: () => setReaction() },
];

const mainMenuItems = [
  { icon: '📺', shortcut: 51, label: 'Screen', state: 'shareScreen', action: () => toggleUserProperty('shareScreen') },
  { icon: '🎥', shortcut: 50, label: 'Camera', state: 'shareVideo', action: () => toggleUserProperty('shareVideo') },
  { icon: '🎤', shortcut: 49, label: 'Audio', state: 'shareAudio', action: () => toggleUserProperty('shareAudio') },
  { icon: '😃', shortcut: 55, label: 'Reactions', action: template => buildMenu(reactionMenuItems, template.items) },
  { icon: '🔔', shortcut: 54, label: 'Voice mail', action: () => { toggleModal('notifications'); Session.set('menu', false); } },
  { icon: '📢',
    label: 'Shout',
    shortcut: 53,
    action: () => userVoiceRecorderAbility.recordVoice(true, sendAudioChunksToUsersInZone),
    cancel: () => userVoiceRecorderAbility.recordVoice(false, sendAudioChunksToUsersInZone),
  },
  { icon: '⚙️', shortcut: 52, label: 'Settings', action: () => { toggleModal('settingsMain'); Session.set('menu', false); } },
];

const otherUserMenuItems = [
  {
    icon: '❤️',
    shortcut: 50,
    label: 'Send love',
    action: () => {
      const user = getMenuActiveUser();
      if (user) setReaction(Random.choice(lovePhrases(user.profile.name)));
    },
    cancel: () => setReaction(),
  },
  {
    icon: '🏃',
    shortcut: 49,
    label: 'Follow',
    action: () => {
      const user = getMenuActiveUser();
      if (!user) {
        lp.notif.warning('Unable to follow this user');
        return;
      }

      userManager.follow(user);
      Session.set('menu', false);
    },
  },
  { icon: '🎙️',
    label: 'Send vocal',
    shortcut: 52,
    action: () => {
      const user = getMenuActiveUser();
      if (!userProximitySensor.isUserNear(user)) {
        lp.notif.error(`${user.profile.name} must be near you`);
        return;
      }

      userVoiceRecorderAbility.recordVoice(true, sendAudioChunksToNearUsers);
    },
    cancel: () => userVoiceRecorderAbility.recordVoice(false, sendAudioChunksToNearUsers),
  },
  { icon: '👤', label: 'Profile', shortcut: 51, action: () => Session.set('modal', { template: 'profile', userId: Session.get('menu')?.userId }) },
];

let menuOpenUsingKey = false;
const keyToOpen = 'alt';
const menuOffset = { x: 0, y: -6 };
const horizontalMenuItemDistance = { x: 45, y: -90 };
const radialMenuRadius = 72;
const mouseDistanceToCloseMenu = 105;
const itemAmountRequiredForBackground = 2;

const computeMenuPosition = () => {
  const position = Session.get('menu-position');
  return { x: (position?.x || 0) + menuOffset.x, y: (position.y || 0) + menuOffset.y };
};

const setReaction = reaction => {
  if (reaction) Meteor.users.update(Meteor.userId(), { $set: { 'profile.reaction': reaction } });
  else Meteor.users.update(Meteor.userId(), { $unset: { 'profile.reaction': 1 } });
};

const buildMenu = (menuItems, reactiveVar) => {
  const items = [];

  if (menuItems.length <= itemAmountRequiredForBackground) {
    for (let i = 0; i < menuItems.length; i++) {
      const x = horizontalMenuItemDistance.x * (i - (menuItems.length - 1) / 2);
      items.push({ ...menuItems[i], x, y: horizontalMenuItemDistance.y });
    }
  } else {
    const theta = 2 * Math.PI / menuItems.length;
    const offset = Math.PI / 2 - theta;

    for (let i = 0; i < menuItems.length; i++) {
      const currentAngle = i * theta + offset;
      const x = radialMenuRadius * Math.cos(currentAngle);
      const y = radialMenuRadius * Math.sin(currentAngle);
      items.push({ ...menuItems[i], x, y });
    }
  }

  reactiveVar.set(items);
};

const onMouseMove = event => {
  if (!Session.get('menu') || menuOpenUsingKey) return;
  const menuPosition = computeMenuPosition();
  const mousePosition = { x: event.clientX, y: event.clientY };
  const offsetY = 38;
  const distance = Math.sqrt((menuPosition.x - mousePosition.x) ** 2 + ((menuPosition.y - offsetY) - mousePosition.y) ** 2);
  if (distance >= mouseDistanceToCloseMenu) Session.set('menu', false);
};

Template.radialMenuItem.helpers({
  isActive(value) { return Meteor.user()?.profile[value]; },
  shortcutLabel() { return String.fromCharCode(this.shortcut); },
});

Template.radialMenu.onCreated(function () {
  this.items = new ReactiveVar(mainMenuItems);
  this.label = new ReactiveVar('Settings');
  this.showShortcuts = new ReactiveVar(false);
  document.addEventListener('mousemove', onMouseMove);
  Session.set('menu-position', { x: 0, y: 0 });

  // allow users to react without opening the menu
  hotkeys('1,2,3,4,5,6,7,8,9', { keyup: true, scope: scopes.player }, e => {
    const menuEntry = reactionMenuItems.find(menuItem => menuItem.shortcut === e.keyCode);
    if (e.type === 'keyup' && menuEntry.cancel) menuEntry.cancel(this);
    else if (e.type === 'keydown' && menuEntry.action) menuEntry.action(this);
  });

  hotkeys('space', { scope: scopes.player }, () => toggleUserProperty('shareAudio'));

  hotkeys('*', { keyup: true, scope: scopes.player }, e => {
    // show/hide shortcuts
    if (e.key.toLowerCase() === keyToOpen) {
      this.showShortcuts.set(e.type === 'keydown');

      // show/hide menu when shift is pressed
      if (e.type === 'keydown' && !Session.get('menu')) {
        menuOpenUsingKey = true;
        const worldScene = game.scene.getScene('WorldScene');
        const userId = Meteor.userId();
        Session.set('menu', { userId });
        Session.set('menu-position', relativePositionToCamera(userManager.players[userId], worldScene.cameras.main));
      } else if (e.type === 'keyup' && menuOpenUsingKey) {
        Session.set('menu', undefined);
        menuOpenUsingKey = false;
      }
    }

    // execute shortcut actions
    if (e.repeat || !hotkeys[keyToOpen]) return;
    const menuItems = !Session.get('menu') ? mainMenuItems : this.items.get();
    const menuEntry = menuItems.find(menuItem => menuItem.shortcut === e.keyCode);
    if (!menuEntry) return;

    if (e.type === 'keyup' && menuEntry.cancel) menuEntry.cancel(this);
    else if (e.type === 'keydown' && menuEntry.action) menuEntry.action(this);
  });

  this.autorun(() => {
    const menu = Session.get('menu');

    if (menu?.userId) {
      const menuItems = menu.userId === Meteor.userId() ? mainMenuItems : otherUserMenuItems;
      buildMenu(menuItems, this.items);
    } else setReaction();
  });
});

Template.radialMenu.onDestroyed(() => {
  hotkeys.unbind('*', scopes.player);
  hotkeys.unbind('space', scopes.player);
});

Template.radialMenu.events({
  'mousedown .js-menu-item'(e) {
    if (this.action) this.action(Template.instance());
    e.preventDefault();
    e.stopPropagation();
  },
  'mouseup .js-menu-item'(e) {
    if (this.cancel) this.cancel();
    e.preventDefault();
    e.stopPropagation();
  },
  'mouseenter .js-menu-item'() { Template.instance().label.set(this.label); },
  'mouseleave .js-menu-item'() { Template.instance().label.set(undefined); },
});

Template.radialMenu.helpers({
  items() { return Template.instance().items.get(); },
  label() { return Template.instance().label.get(); },
  open() { return Session.get('menu'); },
  position() { return computeMenuPosition(); },
  showBackground() { return Template.instance().items.get().length > itemAmountRequiredForBackground; },
  showShortcuts() { return Template.instance().showShortcuts.get(); },
});
