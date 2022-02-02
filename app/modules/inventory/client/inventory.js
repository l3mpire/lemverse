const dropItemDistance = 45;

Template.inventoryItemPanel.helpers({
  exist() { return Session.get('selectedInventoryItem'); },
  name() { return Session.get('selectedInventoryItem')?.name; },
  description() { return Session.get('selectedInventoryItem')?.description || '-'; },
  amount() { return Session.get('selectedInventoryItem')?.amount; },
  thumbnail() { return Session.get('selectedInventoryItem')?.thumbnail; },
});

Template.inventoryItemPanel.events({
  'click .js-drop-item'(e) {
    e.preventDefault();
    e.stopPropagation();

    const itemId = Session.get('selectedInventoryItem')._id;
    const positionInFrontOfPlayer = userManager.getPositionInFrontOfPlayer(userManager.player, dropItemDistance);
    Meteor.call('dropInventoryItem', itemId, positionInFrontOfPlayer);
  },
});

Template.inventoryItem.onCreated(function () {
  this.item = Items.findOne(this.data.item.itemId);
});

Template.inventoryItem.helpers({
  exist() { return Template.instance().item !== undefined && this.item.amount > 0; },
  amount() { return this.item.amount; },
  thumbnail() { return Template.instance().item.thumbnail; },
});

Template.inventoryItem.events({
  'click .js-inventory-item'(e) {
    e.preventDefault();
    e.stopPropagation();
    Session.set('selectedInventoryItem', { ...Template.instance().item, amount: Template.instance().data.item.amount });
  },
});

Template.inventory.onCreated(function () {
  this.inventory = new ReactiveVar([]);
  Session.set('selectedInventoryItem', undefined);

  this.autorun(() => {
    const inventoryItems = Meteor.user().inventory || [];
    const itemsIds = Object.keys(inventoryItems);
    if (!itemsIds?.length) return;

    this.subscribe('items', itemsIds, () => {
      const itemIds = Object.keys(inventoryItems);
      this.inventory.set(itemIds.map(itemId => ({ itemId, amount: inventoryItems[itemId] })));
    });
  });
});

Template.inventory.helpers({
  hasItems() { return Template.instance().inventory.get().length; },
  items() { return Template.instance().inventory.get(); },
});
