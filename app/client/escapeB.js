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
                console.log('Yeah')
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
        
        console.log(Session.get(lockString))
    }
})