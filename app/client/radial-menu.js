/* eslint-disable no-use-before-define */
const reactionMenuItems = [
  { icon: '❤️', index: 1, action: () => setReaction('❤️'), cancel: () => setReaction() },
  { icon: '↩️', index: 8, action: template => buildMenu(mainMenuItems, template.items) },
  { icon: '😲', index: 2, action: () => setReaction('😲'), cancel: () => setReaction() },
  { icon: '😢', index: 3, action: () => setReaction('😢'), cancel: () => setReaction() },
  { icon: '🤣', index: 4, action: () => setReaction('🤣'), cancel: () => setReaction() },
  { icon: '😡', index: 5, action: () => setReaction('😡'), cancel: () => setReaction() },
  { icon: '👍', index: 6, action: () => setReaction('👍'), cancel: () => setReaction() },
  { icon: '👎', index: 7, action: () => setReaction('👎'), cancel: () => setReaction() },
];

const mainMenuItems = [
  { icon: '🎤', index: 1, state: 'shareAudio', action: () => toggleUserProperty('shareAudio') },
  { icon: '🎥', index: 2, state: 'shareVideo', action: () => toggleUserProperty('shareVideo') },
  { icon: '📺', index: 3, state: 'shareScreen', action: () => toggleUserProperty('shareScreen') },
  { icon: '⚙️', index: 4, action: () => { toggleModal('settingsMain'); Session.set('menu', false); } },
  { icon: '🔔', index: 5, action: () => { toggleModal('notifications'); Session.set('menu', false); } },
  { icon: '😃', index: 6, action: template => buildMenu(reactionMenuItems, template.items) },
];

const otherUserMenuItems = [
  { icon: '👤', index: 1, action: () => Session.set('modal', { template: 'profile', userId: Session.get('menu')?.userId }) },
  { icon: '👣',
    index: 2,
    action: () => {
      const userId = Session.get('menu')?.userId;
      if (!userId) return;

      const user = Meteor.users.findOne(userId);
      if (!user) {
        lp.notif.warning('Unable to follow this user');
        return;
      }

      userManager.follow(user);
    } },
];

const itemAmountRequiredForBackground = 4;

const setReaction = reaction => {
  if (reaction) Meteor.users.update(Meteor.userId(), { $set: { 'profile.reaction': reaction } });
  else Meteor.users.update(Meteor.userId(), { $unset: { 'profile.reaction': 1 } });
};

const buildMenu = (menuItems, reactiveVar) => {
  const items = [];

  if (menuItems.length <= itemAmountRequiredForBackground) {
    const radius = 45;
    const y = -90;

    for (let i = 0; i < menuItems.length; i++) {
      const x = radius * (i - (menuItems.length - 1) / 2);
      items.push({ ...menuItems[i], x, y });
    }
  } else {
    const radius = 73;
    const theta = 2 * Math.PI / menuItems.length;
    const offset = Math.PI / 2 - theta - 1.5708;

    for (let i = 0; i < menuItems.length; i++) {
      const currentAngle = i * theta + offset;
      const x = radius * Math.cos(currentAngle);
      const y = radius * Math.sin(currentAngle);
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
  if (distance >= 120) Session.set('menu', false);
};

Template.radialMenuItem.helpers({
  isActive(value) { return Meteor.user().profile[value]; },
});

Template.radialMenu.onCreated(function () {
  this.items = new ReactiveVar(mainMenuItems);
  document.addEventListener('mousemove', onMouseMove);
  Session.set('menu-position', { x: 0, y: 0 });

  hotkeys('space', { scope: scopes.player }, () => toggleUserProperty('shareAudio'));
  hotkeys('*', { keyup: true, scope: scopes.player }, e => {
    if (e.repeat || !hotkeys.shift) return;
    const menuItems = this.items.get() || mainMenuItems;
    const menuEntry = menuItems.find(menuItem => menuItem.index === parseInt(e.key, 10));
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
  'mousedown .js-menu-item'() { if (this.action) this.action(Template.instance()); },
  'mouseup .js-menu-item'() { if (this.cancel) this.cancel(); },
});

Template.radialMenu.helpers({
  items() { return Template.instance().items.get(); },
  open() { return Session.get('menu'); },
  position() { return Session.get('menu-position'); },
  showBackground() { return Template.instance().items.get().length > itemAmountRequiredForBackground; },
});
