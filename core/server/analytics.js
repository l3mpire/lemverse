const Analytics = require('analytics-node');

const { enable, writeKey } = Meteor.settings?.public?.segmentAnalyticsSettings || {};
const isEnabled = enable === true && !!writeKey;
const analyticsInstance = !isEnabled ? undefined : new Analytics(writeKey, { flushAt: 1 });

const newGuildDefaultData = {
  users_count: 1,
};

analytics = {
  identify(user) {
    if (!isEnabled) return;

    const userData = {
      // Reserved traits
      id: user._id,
      name: user.profile.name,
      email: user.emails[0].address,
      created_at: user.createdAt,

      // Custom traits
      login_email_address: user.emails[0].address,
      guild: user.guildId || 'unset',
      mic_permission_state: user.profile.shareAudio,
      camera_permission_state: user.profile.shareVideo,
      screen_permission_state: user.profile.shareScreen,
      login_email_address_verified: user.emails[0].verified,
    };

    const context = {};
    const ddp = DDP._CurrentMethodInvocation.get() || DDP._CurrentPublicationInvocation.get();
    if (ddp?.connection?.httpHeaders?.['x-forwarded-for']) context.ip = ddp.connection.httpHeaders['x-forwarded-for'];
    if (ddp?.connection?.httpHeaders?.['user-agent']) context.userAgent = ddp.connection.httpHeaders['user-agent'];

    try {
      analyticsInstance.identify({ userId: user._id, traits: userData, context });
    } catch (err) {
      log(`analytics.identify: failed to identify user`, { _id: user._id, err });
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
