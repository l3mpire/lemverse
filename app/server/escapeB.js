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
    }
})