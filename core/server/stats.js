import cron from 'node-cron';

stats = {};

Meteor.methods({
  addUserInterruption() {
    const { stats } = Meteor.user();
    const timeSinceLastInterruption = stats?.lastInterruption ? moment.duration(moment().diff(stats.lastInterruption)).asSeconds() : 0;

    let averageTimeBetweenInterruption = timeSinceLastInterruption;
    if (stats?.averageTimeBetweenInterruption) averageTimeBetweenInterruption = (timeSinceLastInterruption + stats.averageTimeBetweenInterruption) / 2.0;

    Meteor.users.update(Meteor.userId(), {
      $set: {
        'stats.lastInterruption': moment().toDate(),
        'stats.averageTimeBetweenInterruption': averageTimeBetweenInterruption,
        'stats.timeSinceLastInterruption': timeSinceLastInterruption,
      },
      $inc: { 'stats.interruptionCounter': 1 },
    });
  },
});

const getInterruptionStats = () => {
  const result = Promise.await(Meteor.users.rawCollection().aggregate([
    {
      $match: {
        'stats.averageTimeBetweenInterruption': {
          $exists: true,
        },
      },
    },
    {
      $group: {
        _id: null,
        averageTimeBetweenInterruption: {
          $avg: '$stats.averageTimeBetweenInterruption',
        },
        averageInterruptionCount: {
          $avg: '$stats.interruptionCounter',
        },
        maxInterruptionCount: {
          $max: '$stats.interruptionCounter',
        },
      },
    },
  ]).toArray());

  if (!result.length) return {};
  const usersCount = Meteor.users.find({ 'stats.averageTimeBetweenInterruption': { $exists: true } }).count();

  return {
    averageInterruptionCount: result[0].averageInterruptionCount || 0,
    averageTimeBetweenInterruption: result[0].averageTimeBetweenInterruption || 0,
    maxInterruptionCount: result[0].maxInterruptionCount || 0,
    usersInterruptedCount: usersCount,
  };
};

const cleanUsersStats = () => Meteor.users.update({}, { $unset: { stats: 1 } }, { multi: true });

lp.deferStartup('stats', () => {
  cron.schedule('0 0 * * *', Meteor.bindEnvironment(() => {
    stats = getInterruptionStats();
    stats.date = new Date();
    cleanUsersStats();
  }));
}, 'stats');
