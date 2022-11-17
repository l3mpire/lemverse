/* eslint-disable no-use-before-define */

import { setReaction } from '../helpers';
import { canUseLevelFeature } from '../../lib/misc';

let menuOpenUsingKey = false;
let menuHandler;
let canvasElement;

const metaKeyCode = 91;
const keyToOpen = 'shift';
const keyToOpenDelay = 200;
const menuOffset = { x: 0, y: -6 };
const radialMenuRadius = 72;
const radialMenuOffsetY = 38;
const mouseDistanceToCloseMenu = 105;
const radialMenuStartingAngle = 0; // in radians
Session.set('radialMenuModules', []);

const menuCurrentUser = (options = {}) => {
  const menu = Session.get('menu');
  if (!menu) return undefined;

  const { userId } = menu;
  if (!userId) return undefined;

  return Meteor.users.findOne(userId, options);
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
  { id: 'notifications', icon: '🔔', order: 0, shortcut: 54, label: 'Notifications', closeMenu: true },
  { id: 'reactions', icon: '😃', order: 1, shortcut: 53, label: 'Reactions' },
];

let otherUserMenuItems = [
  { id: 'follow', icon: '🏃', order: 0, shortcut: 49, label: 'Follow', closeMenu: true },
  { id: 'send-love', icon: '❤️', order: 1, shortcut: 50, label: 'Send love' },
  { id: 'show-profile', icon: '👤', order: 2, label: 'Profile', shortcut: 51 },
  { id: 'send-vocal', icon: '🎙️', order: 3, label: 'Send vocal', shortcut: 52 },
];

Tracker.autorun(track => {
  if (Session.get('loading')) return;

  const user = Meteor.user();
  if (!user) return;

  // If it's an admin, we show the item but if it's disabled for all, the action will be ignored
  const isAdmin = user.roles?.admin;
  if (!isAdmin && !canUseLevelFeature(user, 'reactions')) mainMenuItems.splice(1, 1);

  otherUserMenuItems = otherUserMenuItems.reduce((acc, item) => {
    if (item.id === 'follow' && (!isAdmin && !canUseLevelFeature(user, 'follow'))) return acc;
    if (item.id === 'send-vocal' && (!isAdmin && !canUseLevelFeature(user, 'sendVocal'))) return acc;
    if (item.id === 'send-love' && (!isAdmin && !canUseLevelFeature(user, 'sendLove'))) return acc;

    item.order = acc.length;

    return [...acc, item];
  }, []);

  track.stop();
});


const menuOptions = new ReactiveVar(mainMenuItems);

const additionalOptions = scope => Session.get('radialMenuModules').filter(option => option.scope === scope);

const onMenuOptionSelected = e => {
  const { option, user } = e.detail;

  if (option.id === 'reactions' && canUseLevelFeature(Meteor.user(), 'reactions', true)) buildMenuFromOptions(reactionMenuItems);
  else if (option.id === 'notifications') toggleModal('notifications');
  else if (option.id === 'send-love' && user && canUseLevelFeature(Meteor.user(), 'sendLove', true)) setReaction(Random.choice(lovePhrases(user.profile.name)));
  else if (option.id === 'follow' && user && canUseLevelFeature(Meteor.user(), 'follow', true)) userManager.follow(user);
  else if (option.id === 'show-profile') Session.set('modal', { template: 'userProfile', userId: Session.get('menu')?.userId });
  else if (option.id === 'go-back') buildMenuFromOptions([...mainMenuItems, ...additionalOptions('me')]);
  else if (option.id === 'custom-reaction' && canUseLevelFeature(Meteor.user(), 'reactions', true)) setReaction(Meteor.user().profile.defaultReaction || Meteor.settings.public.defaultReaction);
  else if (option.id === 'emoji' && canUseLevelFeature(Meteor.user(), 'reactions', true)) setReaction(option.icon);
  else if (option.id === 'send-vocal' && user && canUseLevelFeature(Meteor.user(), 'sendVocal', true)) {
    if (!userProximitySensor.isUserNear(user)) {
      lp.notif.error(`${user.profile.name} must be near you`);
      return;
    }

    userVoiceRecorderAbility.recordVoice(true, sendAudioChunksToNearUsers);
  }

  if (option.closeMenu) closeMenu();
};

const onMenuOptionUnselected = e => {
  const { option } = e.detail;

  if (option.id === 'send-love') setReaction();
  else if (option.id === 'send-vocal') userVoiceRecorderAbility.recordVoice(false, sendAudioChunksToNearUsers);
  else if (option.id === 'custom-reaction') setReaction();
  else if (option.id === 'emoji') setReaction();
};

const computeMenuPosition = () => {
  const position = Session.get('menu-position');
  return { x: (position?.x || 0) + menuOffset.x, y: (position.y || 0) + menuOffset.y };
};

const buildMenuFromOptions = options => {
  const newOptions = [];
  const allOptions = options.sort((a, b) => b.order - a.order);


  const theta = (2 * Math.PI) / allOptions.length;
  const offset = Math.PI / 2 - theta;

  for (let i = 0; i < allOptions.length; i++) {
    const currentAngle = (i * theta + offset) + radialMenuStartingAngle;
    const x = radialMenuRadius * Math.cos(currentAngle);
    const y = radialMenuRadius * Math.sin(currentAngle);
    newOptions.push({ ...allOptions[i], x, y });
  }

  menuOptions.set(newOptions);
};

const onMouseMove = event => {
  if (!Session.get('menu') || menuOpenUsingKey) return;
  const menuPosition = computeMenuPosition();

  // Get canvas bound go manage mouse position offset
  if (!canvasElement) canvasElement = document.querySelector('#game canvas');
  const canvasBounds = canvasElement.getBoundingClientRect();
  const mousePosition = {
    x: event.clientX - canvasBounds.x,
    y: event.clientY - canvasBounds.y,
  };
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
  Session.set('menu', undefined);
  Session.set('menu-position', { x: 0, y: 0 });

  document.addEventListener('mousemove', onMouseMove);
  window.addEventListener(eventTypes.onMenuOptionSelected, onMenuOptionSelected);
  window.addEventListener(eventTypes.onMenuOptionUnselected, onMenuOptionUnselected);

  // allow users to react without opening the menu
  hotkeys('1,2,3,4,5,6,7,8,9', { keyup: true, scope: scopes.player }, e => {
    if (e.repeat) return;

    const option = reactionMenuItems.find(menuItem => menuItem.shortcut === e.keyCode);
    if (e.type === 'keyup') window.dispatchEvent(new CustomEvent(eventTypes.onMenuOptionUnselected, { detail: { option } }));
    else if (e.type === 'keydown') window.dispatchEvent(new CustomEvent(eventTypes.onMenuOptionSelected, { detail: { option } }));
  });

  hotkeys('*', { keyup: true, scope: scopes.player }, e => {
    if (e.repeat) return;

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
          const player = userManager.getCharacter(userId);
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
    else if (e.type === 'keydown') window.dispatchEvent(new CustomEvent(eventTypes.onMenuOptionSelected, { detail: { option, user: menuCurrentUser() } }));
  });

  this.autorun(() => {
    const menu = Session.get('menu');

    Tracker.nonreactive(() => {
      if (!menu?.userId) { setReaction(); return; }

      const scope = menu.userId === Meteor.userId() ? 'me' : 'other';
      let options = scope === 'me' ? mainMenuItems : otherUserMenuItems;
      options = [...options, ...additionalOptions(scope)];
      buildMenuFromOptions(options);
    });
  });
});

Template.radialMenu.onDestroyed(() => {
  hotkeys.unbind('*', scopes.player);
});

Template.radialMenu.events({
  'mousedown .js-menu-item'(event) {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent(eventTypes.onMenuOptionSelected, { detail: { option: this, user: menuCurrentUser() } }));
  },
  'mouseup .js-menu-item'(event) {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent(eventTypes.onMenuOptionUnselected, { detail: { option: this } }));
  },
  'mouseenter .js-menu-item'(event, templateInstance) { templateInstance.label.set(this.label); },
  'mouseleave .js-menu-item'(event, templateInstance) { templateInstance.label.set(undefined); },
});

Template.radialMenu.helpers({
  label() { return Template.instance().label.get(); },
  open() { return Session.get('menu'); },
  options() { return menuOptions.get(); },
  position() { return computeMenuPosition(); },
  showShortcuts() { return Template.instance().showShortcuts.get(); },
  username() { return menuCurrentUser({ fields: { 'profile.name': 1 } })?.profile.name; },
});
