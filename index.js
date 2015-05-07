var plastiq = require('plastiq');
var h = plastiq.html;

module.exports = function (options, fn) {
  if (typeof options === 'function') {
    fn = options;
    options = undefined;
  }

  var refresh;
  var throttle = options && options.hasOwnProperty('throttle') && options.throttle !== undefined? options.throttle: 0;

  var promise, awaitingPromise, lastTime, lastValue, timeout;

  var currentValue;

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
      var result = fn(currentValue);
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
    return lastValue !== normalisedValue(currentValue);
  }

  function valueChanged() {
    lastValue = normalisedValue(currentValue);
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

  return function (value) {
    refresh = h.refresh;
    currentValue = value;
    sync();
  }
};

function normalisedValue(value) {
  return value.constructor === Object || value instanceof Array
    ? JSON.stringify(value)
    : value;
}
