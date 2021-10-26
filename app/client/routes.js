const renderRouteName = () => {
  Tracker.autorun(track => {
    let routeName = FlowRouter.getRouteName();
    if (routeName === 'editor') {
      if (!Meteor.loggingIn() && !Meteor.user()) FlowRouter.redirect('/');
      if (Meteor.loggingIn() || !Meteor.user()?.status) { BlazeLayout.render('loading'); return; }
      if (!Meteor.user().roles?.admin) FlowRouter.redirect('/');
    } else if (routeName === 'invite') routeName = 'lemverse';

    BlazeLayout.render('layout', { main: routeName });
    track.stop();
  });
};

Tracker.autorun(() => {
  FlowRouter.watchPathChange();
  log('FlowRouter route', { path: FlowRouter.current().path, params: FlowRouter.current().params, queryParams: FlowRouter.current().queryParams });
});

FlowRouter.route('/', { name: 'lemverse', action: renderRouteName });

FlowRouter.route('/invite/:_levelId', { name: 'invite', action: renderRouteName });

FlowRouter.route('/editor', { name: 'editor', action: renderRouteName });

FlowRouter.route('/levels', { name: 'levels', action: renderRouteName });

FlowRouter.route('/lemescapeB', { name: 'escapeB', action: renderRouteName });
