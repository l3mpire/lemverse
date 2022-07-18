const zoneRectangles = [];
const zoneHideProperties = [
  '_id',
  'x1',
  'y1',
  'x2',
  'y2',
  'levelId',
  'createdAt',
  'createdBy',
  'lastMessageAt',
  'entityId',
];

const clearZoneRectangles = () => zoneRectangles.forEach(r => r.destroy());

//
// zonesToolboxProperties
//

Template.zonesToolboxProperties.helpers({
  properties() {
    const props = _.clone(this.zone);
    zoneHideProperties.forEach(property => { delete props[property]; });
    if (!props.roomName) props.roomName = '';
    if (!props.name) props.name = '';
    if (!props.url) props.url = '';
    if (!props.adminOnly) props.adminOnly = false;
    if (!props.teleportEndpoint) props.teleportEndpoint = '';
    if (!props.unmute) props.unmute = false;
    if (!props.unhide) props.unhide = false;
    if (!props.fullscreen) props.fullscreen = false;
    if (!props.targetedLevelId) props.targetedLevelId = '';
    if (!props.inlineURL) props.inlineURL = '';
    if (!props.hideName) props.hideName = false;
    if (!props.disableCommunications) props.disableCommunications = false;
    if (!props.requiredItems) props.requiredItems = [];
    if (!props.accessRestrictedToGuild) props.accessRestrictedToGuild = false;
    if (!props.messagingRestrictedToGuild) props.messagingRestrictedToGuild = false;

    return JSON.stringify(props, ' ', 2);
  },
  name() { return this.zone.name || this.zone._id; },
});

Template.zonesToolboxProperties.events({
  'click .js-zone-cancel'() { Session.set('displayZoneId', undefined); },
  'click .js-zone-save'() {
    const zoneId = Session.get('displayZoneId');
    const currentFields = Zones.findOne(zoneId);
    let newValues;
    try {
      newValues = JSON.parse($('.zones-toolbox-properties textarea').val());
    } catch (err) { lp.notif.error(`invalid JSON format`, err); }

    const $unset = _.reduce(currentFields, (root, k, i) => {
      const newObject = { ...root };
      if (!zoneHideProperties.includes(i) && !Object.keys(newValues).includes(i)) newObject[i] = 1;
      return newObject;
    }, {});
    if (_.isEmpty($unset)) Zones.update(zoneId, { $set: newValues });
    else Zones.update(zoneId, { $set: newValues, $unset });

    if (characterPopIns.find(`${Meteor.userId()}-${zoneId}`)) characterPopIns.initFromZone(Zones.findOne(zoneId));

    Session.set('displayZoneId', undefined);
  },
  'click .js-zone-delete'() {
    lp.notif.confirm('Zone deletion', `Are you sure to delete the zone "<b>${this.zone.name || this.zone._id}</b>"?`, () => {
      Zones.remove(this.zone._id);
      Session.set('displayZoneId', undefined);
    });
  },
});

//
// zonesToolbox
//

Template.zonesToolbox.onCreated(function () {
  this.autorun(() => {
    const zoneId = Session.get('displayZoneId');

    if (zoneId) Session.set('modal', { template: 'zonesToolboxProperties', zone: Zones.findOne(zoneId) });
    else Session.set('modal', null);
  });
});

Template.zonesToolbox.onRendered(function () {
  this.autorun(() => {
    if (!Session.get('sceneWorldReady')) return;

    clearZoneRectangles();

    const hoveredZoneId = Session.get('hoveredZoneId');
    const selectedZoneId = Session.get('selectedZoneId');

    Zones.find().forEach(zone => {
      const alpha = selectedZoneId === zone._id ? 0.1 : 0.2;
      const color = hoveredZoneId === zone._id ? 0x00FF00 : 0x9966ff;
      const strokeColor = hoveredZoneId === zone._id ? 0x00FF00 : 0xefc53f;
      const strokeAlpha = hoveredZoneId === zone._id ? 0.5 : 1;

      const r = game.scene.keys.WorldScene.add.rectangle(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1, color, alpha);
      r.setOrigin(0, 0);
      r.setStrokeStyle(1, strokeColor, strokeAlpha);
      r.setDepth(20000);
      zoneRectangles.push(r);
    });
  });
});

Template.zonesToolbox.onDestroyed(() => {
  clearZoneRectangles();
  Session.set('displayZoneId', null);
});

Template.zonesToolbox.helpers({
  zones() { return Zones.find(); },
  zonesSortedByDistance() {
    const user = Meteor.user();
    const { x, y } = user.profile;

    return zones.sortByNearest(Zones.find().fetch(), x, y);
  },
  displayZone() { return Zones.findOne(Session.get('displayZoneId')); },
});

Template.zonesToolbox.events({
  'click .js-zone-add'() {
    const { levelId } = Meteor.user().profile;
    const zoneId = Zones.insert({ _id: Zones.id(), createdAt: new Date(), createdBy: Meteor.userId(), levelId });
    Session.set('selectedZoneId', zoneId);
    Session.set('selectedZonePoint', 1);
  },
  'click .js-properties'() {
    Session.set('displayZoneId', this._id);
  },
  'click .js-set1'() {
    Session.set('selectedZoneId', this._id);
    Session.set('selectedZonePoint', 1);
  },
  'click .js-set2'() {
    Session.set('selectedZoneId', this._id);
    Session.set('selectedZonePoint', 2);
  },
  'mousemove .zone'() {
    Session.set('hoveredZoneId', this._id);
  },
});
