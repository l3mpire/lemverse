Template.inventoryItem.onCreated(function () {
  this.item = Items.findOne(this.data.item.itemId);
});

Template.inventoryItem.helpers({
  exist() { return Template.instance().item !== undefined; },
  name() { return Template.instance().item.name; },
  description() { return Template.instance().item.description || '-'; },
  amount() { return this.item.amount; },
  thumbnail() { return Template.instance().item.thumbnail; },
});

Template.inventory.onCreated(function () {
  this.inventory = new ReactiveVar([]);

  this.autorun(() => {
    const inventoryItems = Meteor.user().inventory;
    const itemsIds = inventoryItems.map(inventoryItem => inventoryItem.itemId).filter(Boolean);
    if (itemsIds?.length) {
      this.subscribe('items', itemsIds, () => {
        this.inventory.set(Meteor.user().inventory || []);
      });
    }
  });
});

Template.inventory.helpers({
  items() { return Template.instance().inventory.get(); },
});
