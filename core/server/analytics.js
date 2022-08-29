const Analytics = require('analytics-node');

const { enable, writeKey } = Meteor.settings?.public?.segmentAnalyticsSettings || {};
const isEnabled = enable === true && !!writeKey;
const analyticsInstance = !isEnabled ? undefined : new Analytics(writeKey, { flushAt: 1 });

const newUserDefaultData = {
  mic_permission_state: true,
  camera_permission_state: true,
  screen_permission_state: false,
  login_email_address_verified: false,
  guild: 'unset',
};

const newGuildDefaultData = {
  users_count: 1,
};

analytics = {
  createUser(user) {
    if (!isEnabled) return;

    log('analytics: createUser', { user });

    const userData = {
      user_id: user._id,
      name: user._id,
      $name: user._id,
      $email: '-',
      login_email_address: user.emails[0].address,
      email: user.emails[0].address,
      sign_up_date: user.createdAt,
      guild: user.guildId || 'unset',
    };

    const context = {};
    const ddp = DDP._CurrentMethodInvocation.get() || DDP._CurrentPublicationInvocation.get();
    if (ddp?.connection?.httpHeaders?.['x-forwarded-for']) context.ip = ddp.connection.httpHeaders['x-forwarded-for'];
    if (ddp?.connection?.httpHeaders?.['user-agent']) context.userAgent = ddp.connection.httpHeaders['user-agent'];

    try {
      analyticsInstance.identify({ userId: user._id, traits: { ...userData, ...newUserDefaultData }, context });
      log(`analytics.createUser: new user added`, { _id: user._id });
    } catch (err) {
      log(`analytics.createUser: failed to add new user`, { _id: user._id, err });
    }
  },
  createGuild(userId, guild) {
    if (!isEnabled) return;

    log('analytics: createGuild', { guildId: guild._id, userId });
    const guildData = {
      guild_id: guild._id,
      name: guild.name,
    };

    try {
      analyticsInstance.group({ groupId: guild._id, userId, traits: { ...guildData, ...newGuildDefaultData } });
      log(`analytics.createGuild: new guild created`, { guildId: guild._id });
    } catch (err) {
      log(`analytics.createGuild: failed to create new guild`, { guildId: guild._id, err });
    }
  },

  updateUser(userId, traits) {
    if (!isEnabled) return;

    try {
      analyticsInstance.identify({ userId, traits });
    } catch (err) {
      log(`analytics.updateUser: failed to update user attributes`, { userId, traits, err });
    }
  },

  updateGuild(guildId, traits, userId) {
    if (!isEnabled) return;

    const groupParams = { type: 'group', groupId: guildId, traits: { guild_id: guildId, ...traits } };

    if (userId) groupParams.userId = userId;
    else groupParams.anonymousId = 'anonymous';

    try {
      analyticsInstance.group(groupParams);
    } catch (err) {
      log(`analytics.updateGuild: failed to update guild attributes`, { guildId, traits, err });
    }
  },

  track(userId, event, properties) {
    if (!isEnabled) return;

    try {
      analyticsInstance.track({ event, userId, properties: { ...properties } });
    } catch (err) {
      log(`analytics.track: failed to track event`, { userId, event, properties, err });
    }
  },
  page(userId, name, properties) {
    if (!isEnabled) return;

    try {
      analyticsInstance.page({ type: 'page', userId, name, properties: { ...properties } });
    } catch (err) {
      log(`analytics.page: page failed`, { name, properties, err });
    }
  },
};

Meteor.methods({
  analyticsUpdateUser(traits, editedUserId) {
    const { userId } = this;
    editedUserId ??= userId;

    check(traits, Object);
    check(editedUserId, Match.Id);

    analytics.updateUser(editedUserId, traits);
  },
  analyticsDiscussionAttend(traits) {
    const { userId } = this;
    if (!userId) return;

    check(traits, {
      peerUserId: String,
      usersAttendingCount: Number,
    });

    const user = Meteor.user();
    analytics.track(userId, '💬 Discussion Attend', {
      level_id: user.profile.levelId,
      peer_user_id: traits.peerUserId,
      users_attending_count: traits.usersAttendingCount,
    });
  },
  analyticsDiscussionEnd(traits) {
    const { userId } = this;
    if (!userId) return;

    check(traits, {
      usersAttendingCount: Number,
      duration: Number,
      peerUserId: String,
    });

    const user = Meteor.user();
    analytics.track(userId, '💬 Discussion End', {
      level_id: user.profile.levelId,
      duration: traits.duration,
      users_attending_count: traits.usersAttendingCount,
      peer_user_id: traits.peerUserId,
    });
  },
  analyticsConferenceAttend(traits) {
    const { userId } = this;
    if (!userId) return;

    check(traits, {
      zoneId: String,
      zoneName: String,
    });

    const user = Meteor.user();
    analytics.track(userId, '🎤 Conference Attend', { level_id: user.profile.levelId, zone_id: traits.zoneId, zone_name: traits.zoneName });
  },
  analyticsConferenceEnd(traits) {
    const { userId } = this;
    if (!userId) return;

    check(traits, {
      zoneId: String,
      zoneName: String,
    });

    const user = Meteor.user();
    analytics.track(userId, '🎤 Conference End', { level_id: user.profile.levelId, zone_id: traits.zoneId, zone_name: traits.zoneName });
  },
});
