/* eslint-disable no-use-before-define */
const reactionMenuItems = [
  { icon: '❤️', shortcut: '2', action: () => setReaction('❤️'), cancel: () => setReaction() },
  { icon: '↩️', shortcut: '1', action: template => buildMenu(mainMenuItems, template.items) },
  { icon: '😲', shortcut: '8', action: () => setReaction('😲'), cancel: () => setReaction() },
  { icon: '😢', shortcut: '7', action: () => setReaction('😢'), cancel: () => setReaction() },
  { icon: '🤣', shortcut: '6', action: () => setReaction('🤣'), cancel: () => setReaction() },
  { icon: '😡', shortcut: '5', action: () => setReaction('😡'), cancel: () => setReaction() },
  { icon: '👍', shortcut: '4', action: () => setReaction('👍'), cancel: () => setReaction() },
  { icon: '👎', shortcut: '3', action: () => setReaction('👎'), cancel: () => setReaction() },
];

const mainMenuItems = [
  { icon: '📺', shortcut: '3', label: 'Screen', state: 'shareScreen', action: () => toggleUserProperty('shareScreen') },
  { icon: '🎥', shortcut: '2', label: 'Camera', state: 'shareVideo', action: () => toggleUserProperty('shareVideo') },
  { icon: '🎤', shortcut: '1', label: 'Audio', state: 'shareAudio', action: () => toggleUserProperty('shareAudio') },
  { icon: '😃', shortcut: '6', label: 'Reactions', action: template => buildMenu(reactionMenuItems, template.items) },
  { icon: '🔔', shortcut: '5', label: 'Voice mail', action: () => { toggleModal('notifications'); Session.set('menu', false); } },
  { icon: '⚙️', shortcut: '4', label: 'Settings', action: () => { toggleModal('settingsMain'); Session.set('menu', false); } },
];

const otherUserMenuItems = [
  { icon: '👤', label: 'Profile', shortcut: '1', action: () => Session.set('modal', { template: 'profile', userId: Session.get('menu')?.userId }) },
  {
    icon: '🏃',
    shortcut: '2',
    label: 'Follow',
    action: () => {
      const userId = Session.get('menu')?.userId;
      if (!userId) return;

      const user = Meteor.users.findOne(userId);
      if (!user) {
        lp.notif.warning('Unable to follow this user');
        return;
      }

      userManager.follow(user);
      Session.set('menu', false);
    },
  },
];

const horizontalMenuItemDistance = { x: 45, y: -90 };
const radialMenuRadius = 68;
const mouseDistanceToCloseMenu = 120;
const itemAmountRequiredForBackground = 4;

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
  if (!Session.get('menu')) return;
  const menuPosition = Session.get('menu-position');
  const mousePosition = { x: event.clientX, y: event.clientY };
  const offsetY = 38;
  const distance = Math.sqrt((menuPosition.x - mousePosition.x) ** 2 + ((menuPosition.y - offsetY) - mousePosition.y) ** 2);
  if (distance >= mouseDistanceToCloseMenu) Session.set('menu', false);
};

Template.radialMenuItem.helpers({
  isActive(value) { return Meteor.user().profile[value]; },
});

Template.radialMenu.onCreated(function () {
  this.items = new ReactiveVar(mainMenuItems);
  this.label = new ReactiveVar('Settings');
  this.showShortcuts = new ReactiveVar(false);
  document.addEventListener('mousemove', onMouseMove);
  Session.set('menu-position', { x: 0, y: 0 });

  hotkeys('space', { scope: scopes.player }, () => toggleUserProperty('shareAudio'));
  hotkeys('*', { keyup: true, scope: scopes.player }, e => {
    // show/hide shortcuts
    if (e.key === 'Shift') this.showShortcuts.set(e.type === 'keydown');

    // execute shortcut actions
    if (e.repeat || !hotkeys.shift) return;
    const menuItems = this.items.get() || mainMenuItems;
    const menuEntry = menuItems.find(menuItem => menuItem.shortcut === e.key.toLowerCase());
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
  position() { return Session.get('menu-position'); },
  showBackground() { return Template.instance().items.get().length > itemAmountRequiredForBackground; },
  showShortcuts() { return Template.instance().showShortcuts.get(); },
});
