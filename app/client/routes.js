const renderRouteName = () => {
  Tracker.autorun(track => {
    const routeName = FlowRouter.getRouteName();
    if (routeName === 'tilesets') {
      if (!Meteor.loggingIn() && !Meteor.user()) FlowRouter.redirect('/');
      if (Meteor.loggingIn() || !Meteor.user()?.status) { BlazeLayout.render('loading'); return; }
      if (!Meteor.user().roles?.admin) FlowRouter.redirect('/');
    }

    BlazeLayout.render('layout', { main: FlowRouter.getRouteName() });
    track.stop();
  });
};

Tracker.autorun(() => {
  FlowRouter.watchPathChange();
  log('FlowRouter route', { path: FlowRouter.current().path, params: FlowRouter.current().params, queryParams: FlowRouter.current().queryParams });
});

FlowRouter.route('/', { name: 'lemverse', action: renderRouteName });

FlowRouter.route('/editor', { name: 'editor', action: renderRouteName });

FlowRouter.route('/levels', { name: 'levels', action: renderRouteName });
