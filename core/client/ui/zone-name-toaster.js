Template.zoneNameToaster.onCreated(function () {
  this.toastTimerInstance = undefined;
  this.zoneName = new ReactiveVar('');
  this.style = new ReactiveVar('');

  this.autorun(() => {
    const zoneToasterData = Session.get('zoneToaster');
    if (!zoneToasterData) {
      this.style.set('');
      return;
    }

    Tracker.nonreactive(() => {
      const { name, hasNewContent } = zoneToasterData;
      this.zoneName.set(name);
      this.style.set(`show ${hasNewContent ? 'new-content' : ''}`);

      clearTimeout(this.toastTimerInstance);
      this.toastTimerInstance = setTimeout(() => Session.set('zoneToaster', undefined), hasNewContent ? 5000 : 1500);
    });
  });
});

Template.zoneNameToaster.helpers({
  name() { return Template.instance().zoneName.get(); },
  style() { return Template.instance().style.get(); },
});
