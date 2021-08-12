lp.admins = Meteor.settings.public.lp.admins;

lp.isAdmin = userId => {
  if (!userId && (Meteor.isClient || (DDP._CurrentMethodInvocation.get() || DDP._CurrentPublicationInvocation.get()))) userId = Meteor.userId();

  return !lp.isProduction() || _.contains(lp.admins, userId);
};
