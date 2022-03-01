/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
import Noty from 'noty';
import swal from 'sweetalert';
import mojs from '@mojs/core';

import 'noty/lib/noty.css';
import 'noty/lib/themes/mint.css';

Noty.overrideDefaults({
  layout: 'topRight',
  theme: 'mint',
  timeout: 4000,
  animation: {
    open(promise) {
      const n = this;
      const Timeline = new mojs.Timeline();
      const body = new mojs.Html({
        el: n.barDom,
        x: { [-500]: 0, delay: 0, duration: 500, easing: 'elastic.out' },
        isForce3d: true,
        onComplete() { promise(resolve => { resolve(); }); },
      });

      const parent = new mojs.Shape({
        parent: n.barDom,
        width: 200,
        height: n.barDom.getBoundingClientRect().height,
        radius: 0,
        x: { 150: -150 },
        duration: 1.2 * 500,
        isShowStart: true,
      });

      n.barDom.style.overflow = 'visible';
      parent.el.style.overflow = 'hidden';

      const burst = new mojs.Burst({
        parent: parent.el,
        count: 10,
        top: n.barDom.getBoundingClientRect().height + 75,
        degree: 90,
        radius: 75,
        angle: { [-90]: 40 },
        children: {
          fill: '#EBD761',
          delay: 'stagger(500, -50)',
          radius: 'rand(8, 25)',
          direction: -1,
          isSwirl: true,
        },
      });

      const fadeBurst = new mojs.Burst({
        parent: parent.el,
        count: 2,
        degree: 0,
        angle: 75,
        radius: { 0: 100 },
        top: '90%',
        children: {
          fill: '#EBD761',
          pathScale: [0.65, 1],
          radius: 'rand(12, 15)',
          direction: [-1, 1],
          delay: 0.8 * 500,
          isSwirl: true,
        },
      });

      Timeline.add(body, burst, fadeBurst, parent);
      Timeline.play();
    },
    close(promise) {
      const n = this;
      new mojs.Html({
        el: n.barDom,
        x: { 0: -500, delay: 10, duration: 500, easing: 'cubic.out' },
        skewY: { 0: -10, delay: 10, duration: 500, easing: 'cubic.out' },
        isForce3d: true,
        onComplete() { promise(resolve => { resolve(); }); },
      }).play();

      // if we are on another tab, mojs doesn't call onComplete so we resolve here too, just in case
      lp.timeout(() => { promise(resolve => { resolve(); }); }, 1);
    },
  },
});

lp.notif = {
  success(text) {
    new Noty({ type: 'success', text: lp.purify(text) }).show();
  },
  warning(text) {
    new Noty({ type: 'warning', text: lp.purify(text) }).show();
  },
  error(text) {
    new Noty({ type: 'error', text: lp.purify(text) }).show();
  },
  prompt(title, text, ukn, okCb) {
    swal({ title, text, buttons: true, content: 'input' }).then(value => value !== null && okCb(undefined, value));
  },
  confirm(title, innerHTML, okCb, cancelCb = () => {}) {
    swal({ title, icon: 'warning', buttons: true, dangerMode: true, content: { element: 'div', attributes: { innerHTML: lp.purify(innerHTML) } } }).then(ok => (ok ? okCb() : cancelCb()));
  },
  swal,
  mojs,
};
