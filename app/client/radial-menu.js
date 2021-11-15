const mainMenuItems = [
  { icon: '🎤', toggle: 'shareAudio' },
  { icon: '🎥', toggle: 'shareVideo' },
  { icon: '📺', toggle: 'shareScreen' },
  { icon: '⚙️', modal: 'settingsMain' },
  { icon: '🔔', modal: 'notifications' },
  { icon: '😃', menu: 'reactions' },
];

const reactionMenuItems = [
  { icon: '❤️', reaction: true },
  { icon: '↩️', menu: 'main' },
  { icon: '😲', reaction: true },
  { icon: '😢', reaction: true },
  { icon: '🤣', reaction: true },
  { icon: '😡', reaction: true },
  { icon: '👍', reaction: true },
  { icon: '👎', reaction: true },
];

const buildMenu = (menuItems, reactiveVar) => {
  const radius = 73;
  const theta = 2 * Math.PI / menuItems.length;
  const offset = Math.PI / 2 - theta - 1.5708;

  const items = [];
  for (let i = 0; i < menuItems.length; i++) {
    const currentAngle = i * theta + offset;
    const x = radius * Math.cos(currentAngle);
    const y = radius * Math.sin(currentAngle);
    items.push({ ...menuItems[i], x, y });
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
  this.items = new ReactiveVar([]);
  document.addEventListener('mousemove', onMouseMove);

  this.autorun(() => {
    const open = Session.get('menu');

    if (open) buildMenu(mainMenuItems, this.items);
    else Meteor.users.update(Meteor.userId(), { $unset: { 'profile.reaction': 1 } });
  });
});

Template.radialMenu.events({
  'click .js-menu'() {
    buildMenu(reactionMenuItems, Template.instance().items);
  },
  'click .js-button'() {
    if (this.modal) {
      toggleModal(this.modal);
      Session.set('menu', false);
    } else if (this.menu) {
      const menuItems = this.menu === 'reactions' ? reactionMenuItems : mainMenuItems;
      buildMenu(menuItems, Template.instance().items);
    }
  },
  'click .js-toggle'() {
    toggleUserProperty(this.toggle);
  },
  'touchstart .js-button, mousedown .js-button'() {
    if (this.reaction) Meteor.users.update(Meteor.userId(), { $set: { 'profile.reaction': this.icon } });
  },
  'touchend .js-button, mouseup .js-button'() {
    if (this.reaction) Meteor.users.update(Meteor.userId(), { $unset: { 'profile.reaction': 1 } });
  },
});

Template.radialMenu.helpers({
  items() { return Template.instance().items.get(); },
  open() { return Session.get('menu'); },
  position() { return Session.get('menu-position'); },
});
