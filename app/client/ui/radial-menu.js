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
Session.set('radialMenuAdditionalShortcuts', []);

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
  { id: 'custom-reaction', icon: '🪧', shortcut: 50 },
  { id: 'go-back', icon: '↩️', shortcut: 49 },
  { id: 'emoji', icon: '👏', shortcut: 57 },
  { id: 'emoji', icon: '😲', shortcut: 56 },
  { id: 'emoji', icon: '😢', shortcut: 55 },
  { id: 'emoji', icon: '🤣', shortcut: 54 },
  { id: 'emoji', icon: '🙁', shortcut: 53 },
  { id: 'emoji', icon: '👍', shortcut: 52 },
  { id: 'emoji', icon: '❤️', shortcut: 51 },
];

const mainMenuItems = [
  { id: 'toggle-mic', icon: '🎤', order: 0, shortcut: 49, label: 'Audio', state: 'shareAudio' },
  { id: 'toggle-cam', icon: '🎥', order: 1, shortcut: 50, label: 'Camera', state: 'shareVideo' },
  { id: 'toggle-screen', icon: '📺', order: 2, shortcut: 51, label: 'Screen', state: 'shareScreen' },
  { id: 'settings', icon: '⚙️', order: 3, shortcut: 52, label: 'Settings', closeMenu: true },
  { id: 'reactions', icon: '😃', order: 4, shortcut: 53, label: 'Reactions' },
  { id: 'notifications', icon: '🔔', order: 5, shortcut: 54, label: 'Notifications', closeMenu: true },
  { id: 'shout', icon: '📢', label: 'Shout', order: 40, shortcut: 55 },
];

const otherUserMenuItems = [
  { id: 'send-love', icon: '❤️', shortcut: 50, label: 'Send love' },
  { id: 'follow', icon: '🏃', shortcut: 49, label: 'Follow', closeMenu: true },
  { id: 'send-vocal', icon: '🎙️', label: 'Send vocal', shortcut: 53 },
  { id: 'new-quest', icon: '📜', label: 'New quest', shortcut: 52 },
  { id: 'show-profile', icon: '👤', label: 'Profile', shortcut: 51 },
];

const menuOptions = new ReactiveVar(mainMenuItems);

const additionalOptions = scope => Session.get('radialMenuAdditionalShortcuts').filter(option => option.scope === scope);

const onMenuOptionSelected = e => {
  const { option } = e.detail;

  if (option.id === 'toggle-mic') toggleUserProperty('shareAudio');
  else if (option.id === 'toggle-cam') toggleUserProperty('shareVideo');
  else if (option.id === 'toggle-screen') toggleUserProperty('shareScreen');
  else if (option.id === 'settings') toggleModal('settingsMain');
  else if (option.id === 'reactions') buildMenuFromOptions(reactionMenuItems);
  else if (option.id === 'notifications') toggleModal('notifications');
  else if (option.id === 'shout') userVoiceRecorderAbility.recordVoice(true, sendAudioChunksToUsersInZone);
  else if (option.id === 'send-love') {
    const user = getMenuActiveUser();
    if (user) setReaction(Random.choice(lovePhrases(user.profile.name)));
  } else if (option.id === 'follow') {
    const user = getMenuActiveUser();
    if (!user) {
      lp.notif.warning('Unable to follow this user');
      return;
    }

    userManager.follow(user);
  } else if (option.id === 'send-vocal') {
    const user = getMenuActiveUser();
    if (!userProximitySensor.isUserNear(user)) {
      lp.notif.error(`${user.profile.name} must be near you`);
      return;
    }

    userVoiceRecorderAbility.recordVoice(true, sendAudioChunksToNearUsers);
  } else if (option.id === 'new-quest') {
    const user = getMenuActiveUser();
    if (user) createQuestDraft([user._id], Meteor.userId());
  } else if (option.id === 'show-profile') Session.set('modal', { template: 'profile', userId: Session.get('menu')?.userId });
  else if (option.id === 'go-back') buildMenuFromOptions([...mainMenuItems, ...additionalOptions('me')]);
  else if (option.id === 'custom-reaction') setReaction(Meteor.user().profile.defaultReaction || Meteor.settings.public.defaultReaction);
  else if (option.id === 'emoji') setReaction(option.icon);

  if (option.closeMenu) closeMenu();
};

const onMenuOptionUnselected = e => {
  const { option } = e.detail;

  if (option.id === 'shout') userVoiceRecorderAbility.recordVoice(false, sendAudioChunksToUsersInZone);
  else if (option.id === 'send-love') setReaction();
  else if (option.id === 'send-vocal') userVoiceRecorderAbility.recordVoice(false, sendAudioChunksToNearUsers);
  else if (option.id === 'custom-reaction') setReaction();
  else if (option.id === 'emoji') setReaction();
};

const computeMenuPosition = () => {
  const position = Session.get('menu-position');
  return { x: (position?.x || 0) + menuOffset.x, y: (position.y || 0) + menuOffset.y };
};

const setReaction = reaction => {
  if (reaction) Meteor.users.update(Meteor.userId(), { $set: { 'profile.reaction': reaction } });
  else Meteor.users.update(Meteor.userId(), { $unset: { 'profile.reaction': 1 } });
};

const buildMenuFromOptions = options => {
  const newOptions = [];
  const allOptions = options.sort((a, b) => b.order - a.order);

  if (allOptions.length <= itemAmountRequiredForBackground) {
    for (let i = 0; i < allOptions.length; i++) {
      const x = horizontalMenuItemDistance.x * (i - (options.length - 1) / 2);
      newOptions.push({ ...options[i], x, y: horizontalMenuItemDistance.y });
    }
  } else {
    const theta = 2 * Math.PI / allOptions.length;
    const offset = Math.PI / 2 - theta;

    for (let i = 0; i < allOptions.length; i++) {
      const currentAngle = (i * theta + offset) + 3.8;
      const x = radialMenuRadius * Math.cos(currentAngle);
      const y = radialMenuRadius * Math.sin(currentAngle);
      newOptions.push({ ...allOptions[i], x, y });
    }
  }

  menuOptions.set(newOptions);
};

const onMouseMove = event => {
  if (!Session.get('menu') || menuOpenUsingKey) return;
  const menuPosition = computeMenuPosition();
  const mousePosition = { x: event.clientX, y: event.clientY };
  const distance = Math.sqrt((menuPosition.x - mousePosition.x) ** 2 + ((menuPosition.y - radialMenuOffsetY) - mousePosition.y) ** 2);
  if (distance >= mouseDistanceToCloseMenu) closeMenu();
};

Template.radialMenuOption.helpers({
  isActive(value) { return Meteor.user()?.profile[value]; },
  shortcutLabel() { return String.fromCharCode(this.shortcut); },
});

Template.radialMenu.onCreated(function () {
  this.label = new ReactiveVar('Settings');
  this.showShortcuts = new ReactiveVar(false);
  Session.set('menu-position', { x: 0, y: 0 });

  document.addEventListener('mousemove', onMouseMove);
  window.addEventListener(eventTypes.onMenuOptionSelected, onMenuOptionSelected);
  window.addEventListener(eventTypes.onMenuOptionUnselected, onMenuOptionUnselected);

  // allow users to react without opening the menu
  hotkeys('1,2,3,4,5,6,7,8,9', { keyup: true, scope: scopes.player }, e => {
    const option = reactionMenuItems.find(menuItem => menuItem.shortcut === e.keyCode);
    if (e.type === 'keyup') window.dispatchEvent(new CustomEvent(eventTypes.onMenuOptionSelected, { detail: { option } }));
    else if (e.type === 'keydown') window.dispatchEvent(new CustomEvent(eventTypes.onMenuOptionUnselected, { detail: { option } }));
  });

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
    const options = !Session.get('menu') ? mainMenuItems : menuOptions.get();

    const option = options.find(menuItem => menuItem.shortcut === e.keyCode);
    if (!option) return;

    if (e.type === 'keyup') window.dispatchEvent(new CustomEvent(eventTypes.onMenuOptionUnselected, { detail: { option } }));
    else if (e.type === 'keydown') window.dispatchEvent(new CustomEvent(eventTypes.onMenuOptionSelected, { detail: { option } }));
  });

  this.autorun(() => {
    const menu = Session.get('menu');

    Tracker.nonreactive(() => {
      if (!menu?.userId) { setReaction(); return; }

      const options = menu.userId === Meteor.userId() ? [...mainMenuItems, ...additionalOptions('me')] : otherUserMenuItems;
      buildMenuFromOptions(options);
    });
  });
});

Template.radialMenu.onDestroyed(() => {
  hotkeys.unbind('*', scopes.player);
});

Template.radialMenu.events({
  'mousedown .js-menu-item'(e) {
    window.dispatchEvent(new CustomEvent(eventTypes.onMenuOptionSelected, { detail: { option: this } }));
    e.preventDefault();
    e.stopPropagation();
  },
  'mouseup .js-menu-item'(e) {
    window.dispatchEvent(new CustomEvent(eventTypes.onMenuOptionUnselected, { detail: { option: this } }));
    e.preventDefault();
    e.stopPropagation();
  },
  'mouseenter .js-menu-item'() { Template.instance().label.set(this.label); },
  'mouseleave .js-menu-item'() { Template.instance().label.set(undefined); },
});

Template.radialMenu.helpers({
  options() { return menuOptions.get(); },
  label() { return Template.instance().label.get(); },
  open() { return Session.get('menu'); },
  position() { return computeMenuPosition(); },
  showBackground() { return menuOptions.get().length > itemAmountRequiredForBackground; },
  showShortcuts() { return Template.instance().showShortcuts.get(); },
  username() { return getMenuActiveUser()?.profile.name; },
});
