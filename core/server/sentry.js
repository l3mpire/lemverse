import * as Sentry from '@sentry/node';

export default function initSentryServer() {
  if (!Meteor.settings.public.sentrySettings) return;

  const dsn = Meteor.settings.public.sentrySettings.dsn || null;

  if (!dsn || dsn.length === 0) return;

  const tracesSampleRate = Meteor.settings.public.sentrySettings.tracesSampleRate || 1.0;
  const config = Meteor.settings.public.sentrySettings.serverConfig || {};

  Sentry.init({
    dsn,
    tracesSampleRate,
    ...config,
  });
}
