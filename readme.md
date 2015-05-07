# plastiq-throttle

Throttle calls to a function, by arguments, by time, and by promise completion.

# example

    var throttle = require('plastiq-throttle');

    var searchForUsers = throttle({throttle: 100}, function (query) {
      return http.get('/search?q' + encodeURIComponent(query)).then(function (users) {
        model.users = users;
      });
    });

    searchForUsers('a');     // GET /search?q=a
    searchForUsers('ad');    // -- skip --
    searchForUsers('ada');   // -- skip --
    searchForUsers('adam');  // GET /search?q=adam

It only calls the function if:

* the arguments are different to the last completed call (compared using `===`)
* the promise returned from the last call has completed
* last call was made more than `options.throttle` milliseconds ago

It is especially useful when synchronising client-side state with server-side resources or CPU intensive operations, some examples:

* fetching search results for a given search string, but only if the search string changes, and not too often.
* fetching an object from a server-side API by ID, but only if the ID changes, and not too often.
* performing a heavy search across client-side data, but only if the criteria changes, and not too often.

Also, because it's intended to be used in plastiq apps, your page will refresh after the function completes (if it's throttled by time, or returns a promise).

# api

```js
var throttledFn = throttle([options], fn);

function render() {
  throttledFn(arg1, arg2);

  return vdom;
}
```

* `options.throttle` - the throttle duration, if `0` (the default) then there is no time-based throttling (only based on arguments and promise completion)
* `fn` - a function to be throttled, if it returns a promise, then the next call will be delayed until this promise completes.

    Why wait for promises to complete? To eliminate the risk of race-conditions. Imagine you search for users matching `a` first, then `adam`. If we do them concurrently, then the results for `adam` could come back before the results of `a`. `model.users` will be set to the results of `adam` first and then finally to the results of `a`, quite unexpected.

* `arg1`, `arg2`, ... - arguments to be passed to `fn`.

Note that in order to have the page refreshed when a promise completes, or a throttled call is executed, you must call `throttledFn` inside the render loop, i.e. have `plastiq.html.refresh`.
