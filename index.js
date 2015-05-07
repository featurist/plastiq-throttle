var plastiq = require('plastiq');
var h = plastiq.html;

module.exports = function (options, fn) {
  if (typeof options === 'function') {
    fn = options;
    options = undefined;
  }

  var refresh;
  var throttle = options && options.hasOwnProperty('throttle') && options.throttle !== undefined? options.throttle: 140;

  var promise, awaitingPromise, lastTime, lastValue, timeout;

  var currentThis;
  var currentArguments;

  function callFn(callRefresh) {
    var self = this;

    if (promise) {
      if (!awaitingPromise) {
        promise.then(function () {
          promise = undefined;
          awaitingPromise = undefined;
          sync();
        });

        awaitingPromise = true;
      }
    } else {
      var result = fn.apply(currentThis, currentArguments);
      if (result && typeof result.then === 'function') {
        promise = result;
        promise.then(function () {
          promise = undefined;
          refresh();
        });
      }
      valueChanged();
      lastTime = Date.now();
      if (callRefresh && !promise) {
        refresh();
      }
    }
  }


  function valueHasChanged() {
    if (!lastValue) {
      return true;
    }

    if (currentArguments.length === 0 || lastValue.length !== currentArguments.length) {
      return true;
    }

    for (var n = 0; n < lastValue.length; n++) {
      if (lastValue[n] !== currentArguments[n]) {
        return true;
      }
    }
  }

  function valueChanged() {
    lastValue = currentArguments;
  }

  function sync() {
    var self = this;
    var now = Date.now();

    if (valueHasChanged()) {
      if (throttle === 0) {
        callFn();
      } else {
        if (!lastTime || (lastTime + throttle < now)) {
          callFn();
        } else if (!timeout) {
          var timeoutDuration = lastTime - now + throttle;
          timeout = setTimeout(function () {
            timeout = undefined;
            callFn(true);
          }, timeoutDuration);
        }
      }
    }
  }

  return function () {
    refresh = h.refresh;
    currentThis = this;
    currentArguments = arguments;
    sync();
  }
};
