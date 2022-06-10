lp.isLemverseBeta = flag => {
  const { beta: betas } = Meteor.users.findOne(Meteor.userId(), { fields: { beta: 1 } }) || {};
  if (!betas) return false;
  return betas.includes(flag);
};
