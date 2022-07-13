// eslint-disable-next-line import/no-unresolved
import DOMPurify from 'dompurify';

// escape XSS
lp.purify = (str, options = { FORBID_TAGS: ['form', 'input', 'textarea', 'button', 'base'] }) => str && DOMPurify.sanitize(str, options) || '';

Meteor.startup(() => {
  // so we can track reboot in lemlog
  log(`STARTTOKEN: --------------------------- ${lp.name()} started ----------------------------`);
});

//
// gwendall:body-events@
// https://github.com/gwendall/meteor-body-events
// fork it because it uses an old jquery 1
//

/* eslint-disable */
Template.body.events = function (events) {
  for (const eventMap in events) {
    (function (events, eventMap) {
      const handler = events[eventMap];
      const maps = eventMap.split(',');
      maps.forEach(map => {
        map = $.trim(map);
        const split = map.split(' ');
        const event = split[0];
        if (split.length === 1) {
          $(document).on(event, function (e) {
            const data = {};
            handler.apply(this, [e, data]);
          });
        } else {
          const selector = split.slice(1).join(' ');
          $(document).delegate(selector, event, function (e) {
            const el = $(e.currentTarget).get(0);
            const data = Blaze.getData(el);
            const tpl = (Blaze.getView(el) &&
              _findThisTemplate(Blaze.getView(el))) ||
              {};
            handler.apply(this, [e, data, tpl]);
          });
        }
      });
    }(events, eventMap));
  }
};
function _findThisTemplate(view) {
  let currentView = view;
  
  // If this view is a template instance return it
  do {
    if (currentView._templateInstance) return currentView._templateInstance;
    
    // if not walk up the parents as long as:
    // - current view does not start new lexical scope
    // - and parent view's child does not start new lexical scope
  } while (!(currentView.__startsNewLexicalScope && !(currentView.parentView && currentView.parentView.__childDoesntStartNewLexicalScope)) && (currentView = currentView.parentView));
  return undefined;
}
/* eslint-enable */
