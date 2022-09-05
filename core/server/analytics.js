const Analytics = require('analytics-node');

const { enable, writeKey } = Meteor.settings?.public?.segmentAnalyticsSettings || {};
const isEnabled = enable === true && !!writeKey;
const analyticsInstance = !isEnabled ? undefined : new Analytics(writeKey, { flushAt: 1 });

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
      guild_id: user.guildId,
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

  updateGuild(guild, traits, userId) {
    if (!isEnabled) return;

    const groupParams = {
      groupId: guild._id,
      traits: {
        $name: guild.name, // Mixpanel refuses to use the default name property

        // Reserved traits
        id: guild._id,
        avatar: guild.logo,
        description: guild.description,
        employees: Meteor.users.find({ guildId: guild._id }).count() || 1,
        name: guild.name,
        website: guild.website,
        createdAt: guild.createdAt,

        // Custom traits
        guild_id: guild._id,
        ...traits,
      },
    };

    if (userId) groupParams.userId = userId;
    else groupParams.anonymousId = 'anonymous';

    try {
      analyticsInstance.group(groupParams);
    } catch (err) {
      log(`analytics.updateGuild: failed to update guild attributes`, { guildId: guild._id, traits, err });
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
      analyticsInstance.page({ userId, name, properties: { ...properties } });
    } catch (err) {
      log(`analytics.page: page failed`, { name, properties, err });
    }
  },
};

Meteor.methods({
  analyticsDiscussionAttend(traits) {
    const { userId } = this;
    if (!userId) return;

    check(traits, {
      peerUserId: String,
      usersAttendingCount: Number,
    });

    const user = Meteor.user();
    analytics.track(userId, '💬 Discussion Attend', {
      guild_id: user.guildId,
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
      duration: traits.duration,
      guild_id: user.guildId,
      level_id: user.profile.levelId,
      peer_user_id: traits.peerUserId,
      users_attending_count: traits.usersAttendingCount,
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
    analytics.track(userId, '🎤 Conference Attend', {
      guild_id: user.guildId,
      level_id: user.profile.levelId,
      zone_id: traits.zoneId,
      zone_name: traits.zoneName,
    });
  },
  analyticsConferenceEnd(traits) {
    const { userId } = this;
    if (!userId) return;

    check(traits, {
      zoneId: String,
      zoneName: String,
    });

    const user = Meteor.user();
    analytics.track(userId, '🎤 Conference End', {
      guild_id: user.guildId,
      level_id: user.profile.levelId,
      zone_id: traits.zoneId,
      zone_name: traits.zoneName,
    });
  },
  analyticsReaction(traits) {
    const { userId } = this;
    if (!userId) return;

    check(traits, {
      reaction: String,
    });

    const user = Meteor.user();
    analytics.track(userId, '😂 Reaction', {
      guild_id: user.guildId,
      level_id: user.profile.levelId,
      coordinates: [user.profile.x, user.profile.y],
      reaction: traits.reaction,
    });
  },
  analyticsKick() {
    const { userId } = this;
    if (!userId) return;

    const user = Meteor.user();
    analytics.track(userId, '🦵🏻 Kick', {
      guild_id: user.guildId,
      level_id: user.profile.levelId,
    });
  },
});
