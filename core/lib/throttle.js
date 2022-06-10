/* eslint-disable no-multi-assign,prefer-rest-params */
// Taken from https://github.com/jashkenas/underscore/blob/b713f5a6d75b12c8c57fb3f410df029497c2a43f/modules/throttle.js#L40
// Meteor underscore version is stuck to 1.5.2 which does not have .cancel function
throttle = (func, wait, options) => {
  let timeout; let context; let args; let
    result;
  let previous = 0;
  if (!options) options = {};

  const later = function () {
    previous = options.leading === false ? 0 : new Date();
    timeout = null;
    result = func.apply(context, args);
    if (!timeout) context = args = null;
  };

  const throttled = function () {
    const _now = new Date();
    if (!previous && options.leading === false) previous = _now;
    const remaining = wait - (_now - previous);
    context = this;
    args = arguments;
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = _now;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining);
    }
    return result;
  };

  throttled.cancel = function () {
    clearTimeout(timeout);
    previous = 0;
    timeout = context = args = null;
  };

  return throttled;
};
