const createQuest = () => {
  const questId = Quests.id();
  Quests.insert({
    _id: questId,
    owners: [],
    createdAt: new Date(),
    createdBy: Meteor.userId(),
  });

  Session.set('modal', undefined);
  Session.set('quests', true);
  Session.set('console', true);
};

const toggleSubscribe = entity => Meteor.call('toggleEntitySubscriber', entity._id, Meteor.userId());

Template.questEntity.events({
  'click .js-quest-create'(e) {
    e.preventDefault();
    e.stopPropagation();
    createQuest();
  },
  'click .js-quest-subscribe'(e, template) {
    e.preventDefault();
    e.stopPropagation();
    toggleSubscribe(template.data.entity);
  },
});

Template.questEntity.onCreated(function () {
  this.entity = new ReactiveVar();

  this.autorun(() => {
    const modal = Session.get('modal');
    if (!modal?.entity || !modal.template.includes('questEntity')) return;
    this.entity.set(modal.entity);

    Tracker.nonreactive(() => {
      const userIds = modal.entity.meta?.subscribers || [];
      if (userIds.length) this.subscribe('usernames', userIds);
    });
  });
});

Template.questEntity.helpers({
  subscribers() {
    const entity = Entities.findOne(this.entity._id);
    const userIds = entity.meta?.subscribers || [];
    return Meteor.users.find({ _id: { $in: userIds } }).fetch();
  },
  userSubscribed() {
    const entity = Entities.findOne(this.entity._id);
    const userIds = entity.meta?.subscribers || [];
    return userIds.includes(Meteor.userId());
  },
});
