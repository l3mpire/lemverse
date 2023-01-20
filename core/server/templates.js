import '../collections';
console.log('templates.js');

Meteor.publish('templates', function () {
    return Templates.find();
});
