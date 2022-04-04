Template.zoneNameToaster.onCreated(function () {
  this.toastTimerInstance = undefined;
  this.zoneName = new ReactiveVar('');
  this.style = new ReactiveVar('');

  this.autorun(() => {
    const zone = Session.get('showZoneName');
    if (!zone) {
      this.style.set('');
      return;
    }

    Tracker.nonreactive(() => {
      const hasNewContent = zones.hasNewContent(zone);
      this.zoneName.set(zone.name);
      this.style.set(`show ${hasNewContent ? 'new-content' : ''}`);

      clearTimeout(this.toastTimerInstance);
      this.toastTimerInstance = setTimeout(() => Session.set('showZoneName', undefined), hasNewContent ? 5000 : 1500);
    });
  });
});

Template.zoneNameToaster.helpers({
  name() { return Template.instance().zoneName.get(); },
  style() { return Template.instance().style.get(); },
});
