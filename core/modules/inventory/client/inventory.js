const dropItemDistance = 45;

window.addEventListener('load', () => {
  hotkeys('i', { scope: scopes.player }, e => {
    e.preventDefault();
    e.stopPropagation();
    toggleModal('inventory');
  });

  window.addEventListener(eventTypes.onMenuOptionSelected, e => {
    const { option } = e.detail;
    if (option.id === 'open-inventory') toggleModal('inventory');
  });

  Tracker.autorun(() => {
    const user = Meteor.user({ fields: { guildId: 1 } });
    if (!user || !user.guildId) return;

    Tracker.nonreactive(() => {
      registerRadialMenuModules([{ id: 'open-inventory', icon: '📦', shortcut: 73, label: 'Inventory', closeMenu: true, scope: 'me' }]);
    });
  });
});

Template.inventoryItemPanel.helpers({
  exist() { return Session.get('selectedInventoryItem'); },
  name() { return Session.get('selectedInventoryItem')?.name; },
  description() { return Session.get('selectedInventoryItem')?.description || '-'; },
  amount() { return Meteor.user().inventory[Session.get('selectedInventoryItem')?._id] || 0; },
  thumbnail() { return Session.get('selectedInventoryItem')?.thumbnail; },
});

Template.inventoryItemPanel.events({
  'click .js-drop-item'(event) {
    event.preventDefault();
    event.stopPropagation();

    const itemId = Session.get('selectedInventoryItem')._id;
    const positionInFrontOfPlayer = userManager.getPositionInFrontOfCharacter(userManager.getControlledCharacter(), dropItemDistance);
    Meteor.call('dropInventoryItem', itemId, positionInFrontOfPlayer, (error, editedItems) => {
      if (error) { lp.notif.error('An error occured during the drop'); return; }
      if (!editedItems[itemId]) Session.set('selectedInventoryItem', undefined);
    });
  },
});

Template.inventoryItem.onCreated(function () {
  this.item = Items.findOne(this.data.item.itemId);
});

Template.inventoryItem.helpers({
  exist() { return Template.instance().item !== undefined && Meteor.user().inventory[this.item.itemId] > 0; },
  amount() { return Meteor.user().inventory[this.item.itemId] || 0; },
  thumbnail() { return Template.instance().item.thumbnail; },
});

Template.inventoryItem.events({
  'click .js-inventory-item'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();
    Session.set('selectedInventoryItem', { ...templateInstance.item, amount: templateInstance.data.item.amount });
  },
});

Template.inventory.onCreated(function () {
  this.inventory = new ReactiveVar([]);
  Session.set('selectedInventoryItem', undefined);

  this.autorun(() => {
    const inventoryItems = Meteor.user().inventory || {};
    const itemsIds = Object.keys(inventoryItems);
    this.inventory.set([]);
    if (!itemsIds?.length) {
      this.inventory.set([]);
      return;
    }

    this.subscribe('items', itemsIds, () => {
      const itemIds = Object.keys(inventoryItems);
      this.inventory.set(itemIds.map(itemId => ({ itemId, amount: inventoryItems[itemId] })).filter(item => item.amount > 0));
    });
  });
});

Template.inventory.helpers({
  hasItems() { return Template.instance().inventory.get().length; },
  items() { return Template.instance().inventory.get(); },
});
