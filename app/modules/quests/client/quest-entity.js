const refreshSubscriberList = template => {
  Meteor.call('subscribedUsers', template.data.entity._id, (error, users) => template.subscribers.set(users));
};

const toggleSubscribe = (entity, callback) => Meteor.call('toggleEntitySubscription', entity._id, callback);

Template.questEntity.events({
  'click .js-quest-create'(e, template) {
    e.preventDefault();
    e.stopPropagation();

    Session.set('modal', undefined);
    createQuestDraft([], template.data.entity._id);
  },
  'click .js-quest-subscribe'(e, template) {
    e.preventDefault();
    e.stopPropagation();
    toggleSubscribe(template.data.entity, () => refreshSubscriberList(template));
  },
});

Template.questEntity.onCreated(function () {
  this.entity = new ReactiveVar();
  this.subscribers = new ReactiveVar([]);

  this.autorun(() => {
    const modal = Session.get('modal');
    if (!modal?.entity || !modal.template.includes('questEntity')) return;
    this.entity.set(modal.entity);
    refreshSubscriberList(this);
  });
});

Template.questEntity.helpers({
  userSubscribed() {
    const subscriptions = Meteor.user().entitySubscriptionIds || [];
    return subscriptions.includes(Template.instance().entity.get()?._id);
  },
  subscribers() { return Template.instance().subscribers.get(); },
  title() { return Template.instance().entity.get().name || 'Quest builder'; },
});
