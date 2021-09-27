// test append images 
// import gm from 'gm';
const gm = require('gm')

const w = 384;
const h = 128;
const body = "/Users/martindonadieu/Downloads/lemlist_lemverse_tilesset/copr.png"
const clothes = "/Users/martindonadieu/Downloads/lemlist_lemverse_tilesset/clothe_12.png"
const hairs = "/Users/martindonadieu/Downloads/lemlist_lemverse_tilesset/head_1.png"
const eyes = "/Users/martindonadieu/Downloads/lemlist_lemverse_tilesset/glasse.png.png"
const accessory = "/Users/martindonadieu/Downloads/lemlist_lemverse_tilesset/acc17.png"
const result = "/Users/martindonadieu/Downloads/lemlist_lemverse_tilesset/merged.png"


img = gm(w, h);
img.in(body)
.in(clothes)
.in('-geometry', "+0+0")
.in('-page', "+0+0")
.in(hairs)
.in('-geometry', "+0+0")
.in('-page', "+0+0")
.in(eyes)
.in('-geometry', "+0+0")
.in('-page', "+0+0")
.in(accessory)
.in('-geometry', "+0+0")
.in('-page', "+0+0")
.mosaic()
.write(result, (err) => {
    if (!err) console.log('done');
    else console.log(err);
});