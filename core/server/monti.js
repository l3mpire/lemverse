import { Monti } from 'meteor/montiapm:agent';

export default function initMonti() {
  const montiSettings = Meteor.settings.monti;
  if (!montiSettings?.appId || !montiSettings?.appSecret) return;
  Monti.startContinuousProfiling();
}
