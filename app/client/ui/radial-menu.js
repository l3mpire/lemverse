/* eslint-disable no-use-before-define */

let menuOpenUsingKey = false;
const metaKeyCode = 91;
const keyToOpen = 'shift';
const keyToOpenDelay = 200;
const menuOffset = { x: 0, y: -6 };
const horizontalMenuItemDistance = { x: 45, y: -90 };
const radialMenuRadius = 72;
const radialMenuOffsetY = 38;
const mouseDistanceToCloseMenu = 105;
const itemAmountRequiredForBackground = 2;
let menuHandler;

const getMenuActiveUser = () => {
  const menu = Session.get('menu');
  if (!menu) return undefined;

  const { userId } = menu;
  if (!userId) return undefined;

  return Meteor.users.findOne(userId);
};

const lovePhrases = userName => [
  `You are the best ${userName}`,
  `You are gorgeous ${userName}`,
  `Have a good day ${userName}!`,
  `I hope your day is great ${userName}`,
];

const closeMenu = () => {
  clearTimeout(menuHandler);
  Session.set('menu', undefined);
  menuOpenUsingKey = false;
};

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
  { icon: '📦', shortcut: 73, label: 'Inventory', action: () => { toggleModal('inventory'); closeMenu(); } },
  { icon: '😃', shortcut: 57, label: 'Reactions', action: template => buildMenu(reactionMenuItems, template.items) },
  { icon: '🔔', shortcut: 56, label: 'Notifications', action: () => { toggleModal('notifications'); closeMenu(); } },
  { icon: '📜', shortcut: 55, label: 'Quests', action: () => { Session.set('quests', { origin: 'menu' }); closeMenu(); } },
  { icon: '💬', shortcut: 54, label: 'Text', action: () => { openConsole(true); closeMenu(); } },
  { icon: '📢',
    label: 'Shout',
    shortcut: 53,
    action: () => userVoiceRecorderAbility.recordVoice(true, sendAudioChunksToUsersInZone),
    cancel: () => userVoiceRecorderAbility.recordVoice(false, sendAudioChunksToUsersInZone),
  },
  { icon: '⚙️', shortcut: 52, label: 'Settings', action: () => { toggleModal('settingsMain'); closeMenu(); } },
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
      closeMenu();
    },
  },
  { icon: '🎙️',
    label: 'Send vocal',
    shortcut: 53,
    action: () => {
      const user = getMenuActiveUser();
      if (!userProximitySensor.isUserNear(user)) {
        lp.notif.error(`${user.profile.name} must be near you`);
        return;
      }

      userVoiceRecorderAbility.recordVoice(true, sendAudioChunksToNearUsers);
    },
    cancel: () => userVoiceRecorderAbility.recordVoice(false, sendAudioChunksToNearUsers),
  }, {
    icon: '📜',
    label: 'New quest',
    shortcut: 52,
    action: () => {
      const user = getMenuActiveUser();
      if (user) createQuestDraft([user._id], Meteor.userId());
    },
  },
  { icon: '👤', label: 'Profile', shortcut: 51, action: () => Session.set('modal', { template: 'profile', userId: Session.get('menu')?.userId }) },
];

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
  const distance = Math.sqrt((menuPosition.x - mousePosition.x) ** 2 + ((menuPosition.y - radialMenuOffsetY) - mousePosition.y) ** 2);
  if (distance >= mouseDistanceToCloseMenu) closeMenu();
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
    if (e.key.toLowerCase() === keyToOpen && !hotkeys.isPressed(metaKeyCode)) {
      this.showShortcuts.set(e.type === 'keydown');

      // show/hide the menu when the special key is pressed
      if (e.type === 'keydown' && !Session.get('menu')) {
        clearTimeout(menuHandler);
        menuHandler = setTimeout(() => {
          menuOpenUsingKey = true;
          const worldScene = game.scene.getScene('WorldScene');
          const userId = Meteor.userId();
          const player = userManager.players[userId];
          if (!player) return;

          Session.set('menu', { userId });
          Session.set('menu-position', relativePositionToCamera(player, worldScene.cameras.main));
        }, keyToOpenDelay);
      } else if (e.type === 'keyup') closeMenu();
    }

    // close the menu if the meta key (command) is pressed
    if (hotkeys.isPressed(metaKeyCode)) closeMenu();

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

    Tracker.nonreactive(() => {
      if (!menu?.userId) { setReaction(); return; }

      const menuItems = menu.userId === Meteor.userId() ? mainMenuItems : otherUserMenuItems;
      buildMenu(menuItems, this.items);
    });
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
  username() { return getMenuActiveUser()?.profile.name; },
});
