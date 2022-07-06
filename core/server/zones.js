const privateFields = { uuid: 0 };

Meteor.publish('zones', function (levelId) {
  check(levelId, Match.Maybe(Match.Id));
  if (!this.userId) return undefined;
  if (!levelId) levelId = Meteor.settings.defaultLevelId;

  return Zones.find({ levelId }, { fields: privateFields });
});
