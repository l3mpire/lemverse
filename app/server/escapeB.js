Meteor.methods({
    enlightenZone(name) {
        log('enlightenZone: start', {name})
        const allTiles = Tiles.find({"metadata.zoneName": name}).fetch()
        if (!allTiles) return
        Tiles.update({_id: { $in: allTiles.map(tile=> tile._id)}}, {$set: {"invisible": true}},{multi: true})
        log('enlightenZone: updating', {nbTiles: allTiles.length})
    },
    darkenZone(name) {
        log('darkenZone: start', {name})
        const allTiles = Tiles.find({"metadata.zoneName": name}).fetch()
        if (!allTiles) return
        Tiles.update({_id: { $in: allTiles.map(tile=> tile._id)}}, {$set: {"invisible": false}},{multi: true})
        log('enlightenZone: updating', {nbTiles: allTiles.length})
    },
    toggleZone(name) {
        log('toggleZone: start', {name})
        const allTiles = Tiles.find({"metadata.zoneName": name}).fetch()
        if (!allTiles) return
        const invisible = !allTiles[0].invisible;
        Tiles.update({_id: { $in: allTiles.map(tile=> tile._id)}}, {$set: {invisible}},{multi: true})
        log('toggleZone: updating', {nbTiles: allTiles.length})
    },
    escapeStart(zone, usersInZone, levelId) {
        log('escapeStart: start', {zone, usersInZone, levelId})
        // Start time
        Levels.update({_id: levelId}, {$set: {'metadata.start': Date.now()}})
        // Open locked door
        Tiles.update({levelId, 'metadata.startDoors': true}, {$set: {invisible: true}}, {multi:true})
    }
})