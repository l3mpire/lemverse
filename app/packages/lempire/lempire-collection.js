lp.collections = { usr: Meteor.users };

lp.collection = string => lp.collections[string.substr(0, 3)];
