import * as Sentry from '@sentry/browser';
import { BrowserTracing } from '@sentry/tracing';

export default function initSentryClient() {
  if (!Meteor.settings.public.sentrySettings) return;

  const dsn = Meteor.settings.public.sentrySettings.dsn || null;

  if (!dsn || dsn.length === 0) return;

  const tracesSampleRate = Meteor.settings.public.sentrySettings.tracesSampleRate || 1.0;
  const config = Meteor.settings.public.sentrySettings.clientConfig || {};

  Sentry.init({
    dsn,
    tracesSampleRate,
    integrations: [new BrowserTracing()],
    ...config,
  });

  const originalDebug = Meteor._debug;
  Meteor._debug = (...args) => {
    if (args[1] instanceof Error) Sentry.captureException(args[1]);
    else Sentry.captureMessage(new Error(args.join(' ')));

    originalDebug(...args);
  };
}
