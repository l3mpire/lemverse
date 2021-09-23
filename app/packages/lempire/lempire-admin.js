lp.gods = Meteor.settings.public.lp.gods;

lp.isGod = userId => {
  if (!userId && (Meteor.isClient || (DDP._CurrentMethodInvocation.get() || DDP._CurrentPublicationInvocation.get()))) userId = Meteor.userId();

  return !lp.isProduction() || _.contains(lp.gods, userId);
};
