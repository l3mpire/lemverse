Template.escapeB.helpers({
    iframe() {
        return FlowRouter.current().queryParams.n
    }
})

Template.escapeB.events({
    'click .js-key-code'(e) {
        const {lock, code}= e.currentTarget.dataset
        const lockString = `lock${lock}`
        if (code === 'VALIDATE') {
            if (Session.get(lockString) === '1234') {
                // Success
                // Meteor.call('darkenZone', 'labyrinth-part1')
                Meteor.call('enlightenZone', 'labyrinth-part1')
            } else {
                // Failure
                console.log('Not good')
                document.querySelector('#redLed').classList.remove('hide');
                setTimeout(()=> {
                    document.querySelector('#redLed').classList.add('hide');
                }, 3000);
            }
            Session.set(lockString, '')
        } else if (code ==='CLEAR') {
            Session.set(lockString, '')
        } else {
            Session.set(lockString, `${Session.get(lockString) || ''}${code}`)
        }
    },
    'click .js-activate-switch'(e) {
        const zone = e.currentTarget.dataset.zone;
        if (!zone) return
        Meteor.call('toggleZone', zone)
    }
})