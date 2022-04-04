Template.zoneNameToaster.onCreated(function () {
  this.toastTimerInstance = undefined;
  this.zone = new ReactiveVar();
  this.zoneName = new ReactiveVar('');

  this.autorun(() => {
    this.zone.set(Session.get('showZoneName'));
    if (!this.zone.get()) return;

    Tracker.nonreactive(() => {
      const zone = this.zone.get();

      this.zoneName.set(zone.name);
      const hasNewContent = zones.hasNewContent(zone);

      clearTimeout(this.toastTimerInstance);
      this.toastTimerInstance = setTimeout(() => Session.set('showZoneName', undefined), hasNewContent ? 5000 : 1500);
    });
  });
});

Template.zoneNameToaster.helpers({
  name() { return Template.instance().zoneName.get(); },
  classes() {
    const zone = Template.instance().zone.get();
    if (!zone) return '';

    const hasNewContent = zones.hasNewContent(zone);
    return `show ${hasNewContent ? 'new-content' : ''}`;
  },
});
