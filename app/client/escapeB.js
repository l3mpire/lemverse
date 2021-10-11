Template.escapeB.helpers({
    iframe() {
        return FlowRouter.current().queryParams.n
    }
})

Template.escapeB.events({
    'click .js-key-code'(e) {
        const {lock, code}= e.currentTarget.dataset
        const lockString = `lock${lock}`
        if (code === 'V') {
            if (Session.get(lockString) === '1234') {
                // Success
                // Meteor.call('darkenZone', 'labyrinth-part1')
                Meteor.call('enlightenZone', 'labyrinth-part1')
            } else {
                // Failure
                console.log('Not good')
            }
            Session.set(lockString, '')
        } else if (code ==='C') {
            Session.set(lockString, '')
        } else {
            Session.set(lockString, `${Session.get(lockString) || ''}${code}`)
        }
    }
})