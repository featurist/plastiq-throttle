var chai = require('chai');
var expect = chai.expect;
var throttle = require('..');
var plastiq = require('plastiq');
var h = plastiq.html;

describe('throttle', function () {
  var called;

  function expectToBeCalled(fn) {
    var c = called;
    fn();
    expect(called, "expected to be called").to.equal(c + 1);
  }

  function expectNotToBeCalled(fn) {
    var c = called;
    fn();
    expect(called, "expected not to be called").to.equal(c);
  }

  beforeEach(function () {
    called = 0;
  });

  describe('synchronous actions', function () {
    var calledRefresh = false;

    beforeEach(function () {
      calledRefresh = false;
    });

    context('without throttling', function () {
      var value;
      var t;

      beforeEach(function () {
        t = throttle({throttle: 0}, function (n) {
          value = n;
          called++;
        });

        h.refresh = function () {
          calledRefresh = true;
        };
      });

      afterEach(function () {
        expect(calledRefresh).to.be.false;
      });

      it('runs the first time', function () {
        expectToBeCalled(function () { t(1); });
        expect(value).to.equal(1);
      });

      it("isn't run the second time", function () {
        expectToBeCalled(function () { t(1); });
        expectNotToBeCalled(function () { t(1); });
        expect(value).to.equal(1);
      });

      it("is run the second time if the value is different", function () {
        expectToBeCalled(function () { t(1); });
        expectToBeCalled(function () { t(2); });
        expect(value).to.equal(2);
      });

      it("is not run the third time if the value is the same as the second", function () {
        expectToBeCalled(function () { t(1); });
        expectToBeCalled(function () { t(2); });
        expectNotToBeCalled(function () { t(2); });
        expect(value).to.equal(2);
      });

      it("is run the third time if the value is same as first", function () {
        expectToBeCalled(function () { t(1); });
        expectToBeCalled(function () { t(2); });
        expectToBeCalled(function () { t(1); });
        expect(value).to.equal(1);
      });
    });

    context('with throttling', function () {
      var throttleDuration = 10;

      beforeEach(function () {
        calledRefresh = false;
        called = 0;

        t = throttle({throttle: throttleDuration}, function (n) {
          value = n;
          called++;
        });
      });

      it('runs the first time', function () {
        expectToBeCalled(function () { t(1); });
        expect(value).to.equal(1);
      });

      it("doesn't run the second time if the value is the same", function () {
        expectToBeCalled(function () { t(1); });
        expectNotToBeCalled(function () { t(1); });

        return wait(throttleDuration * 2).then(function () {
          expect(called).to.equal(1);
          expect(calledRefresh).to.be.false;
        });
      });

      it('runs the second time if the value is different, but delayed', function () {
        return new Promise(function (done) {
          h.refresh = done;

          expectToBeCalled(function () { t(1); });
          expectNotToBeCalled(function () { t(2); });
        }).then(function () {
          expect(value).to.equal(2);
        });
      });

      it("when throttled, doesn't run intermediate values, only the last", function () {
        return new Promise(function (done) {
          h.refresh = done;

          expectToBeCalled(function () { t(1); });
          expectNotToBeCalled(function () { t(2); });
          expectNotToBeCalled(function () { t(3); });
          expectNotToBeCalled(function () { t(4); });
          expectNotToBeCalled(function () { t(5); });
        }).then(function () {
          expect(value).to.equal(5);
          expect(called).to.equal(2);
        });
      });
    });
  });

  describe('asynchronous actions', function () {
    context('without throttle', function () {
      var t;
      var values;

      beforeEach(function () {
        values = [];

        t = throttle({throttle: 0}, function (n) {
          called++;
          values.push('starting ' + n);
          return wait(10).then(function () {
            values.push('finishing ' + n);
          });
        });
      });

      it('calls refresh when promise is done', function () {
        return new Promise(function (done) {
          h.refresh = done;

          expectToBeCalled(function () { t(1); });
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1'
          ]);
        });
      });

      it('calls the second time if the first one has finished', function () {
        return new Promise(function (done) {
          h.refresh = done;
          expectToBeCalled(function () { t(1); });
        }).then(function () {
          return new Promise(function (done) {
            expect(values).to.eql([
              'starting 1',
              'finishing 1'
            ]);

            h.refresh = done;
            expectToBeCalled(function () { t(2); });
          });
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1',
            'starting 2',
            'finishing 2'
          ]);
        });
      });

      it("doesn't call second time if value is the same", function () {
        return new Promise(function (done) {
          h.refresh = done;

          expectToBeCalled(function () { t(1); });
          expectNotToBeCalled(function () { t(1); });
        }).then(function () {
          return wait(20);
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1'
          ]);
        });
      });

      it("calls the second time if the value is different, but not before first promise is done", function () {
        return new Promise(function (done) {
          h.refresh = done;

          expectToBeCalled(function () { t(1); });
          expectNotToBeCalled(function () { t(2); });
        }).then(function () {
          return wait(20);
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1',
            'starting 2',
            'finishing 2'
          ]);
        });
      });

      it("doesn't call intermediate values if waiting for a promise to finish", function () {
        return new Promise(function (done) {
          h.refresh = done;

          expectToBeCalled(function () { t(1); });
          expectNotToBeCalled(function () { t(2); });
          expectNotToBeCalled(function () { t(3); });
          expectNotToBeCalled(function () { t(4); });
          expectNotToBeCalled(function () { t(5); });
        }).then(function () {
          return wait(20);
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1',
            'starting 5',
            'finishing 5'
          ]);
        });
      });
    });

    context('with throttling', function () {
      var throttleDuration = 20;
      var values;
      var promise;
      var promiseDuration;

      beforeEach(function () {
        called = 0;
        values = [];
        promiseDuration = 0;

        t = throttle({throttle: throttleDuration}, function (n) {
          called++;
          values.push('starting ' + n);
          return promise = wait(promiseDuration).then(function () {
            values.push('finishing ' + n);
          });
        });
      });

      it('runs the first time', function () {
        return new Promise(function (done) {
          h.refresh = done;
          expectToBeCalled(function () { t(1); });
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1'
          ]);
        });
      });

      it("skips calls if they are within the throttle, but always runs the last", function () {
        h.refresh = function () {};

        expectToBeCalled(function () { t(1); });
        return wait(5).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1',
          ]);
          expectNotToBeCalled(function () { t(2); });
        }).then(function () {
          return wait(1);
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1',
          ]);
          expectNotToBeCalled(function () { t(3); });
        }).then(function () {
          return wait(1);
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1',
          ]);
          expectNotToBeCalled(function () { t(4); });
        }).then(function () {
          return wait(1);
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1',
          ]);
          expectNotToBeCalled(function () { t(5); });
        }).then(function () {
          return wait(throttleDuration * 2);
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1',
            'starting 5',
            'finishing 5'
          ]);
        });
      });

      it('for throttled calls, calls refresh at start and end of promise call', function () {
        var refreshValues = [];

        return new Promise(function (done) {
          var refreshed = 0;

          h.refresh = function () {
            refreshed++;

            refreshValues.push(values.slice());

            if (refreshed >= 3) {
              done();
            }
          };

          t(1);
          t(2);
        }).then(function () {
          expect(refreshValues).to.eql([
            ['starting 1', 'finishing 1'],
            ['starting 1', 'finishing 1', 'starting 2'],
            ['starting 1', 'finishing 1', 'starting 2', 'finishing 2']
          ]);
        });
      });

      context('when the promise takes longer than the throttle', function () {
        beforeEach(function () {
          promiseDuration = 40;
        });

        it('runs each promise one after the other', function () {
          return new Promise(function (done) {
            h.refresh = done;
            expectToBeCalled(function () { t(1); });
          }).then(function () {
            return promise;
          }).then(function () {
            return wait(1);
          }).then(function () {
            expect(values).to.eql([
              'starting 1',
              'finishing 1'
            ]);
            expectToBeCalled(function () { t(2); });
          }).then(function () {
            return promise;
          }).then(function () {
            return wait(1);
          }).then(function () {
            expect(values).to.eql([
              'starting 1',
              'finishing 1',
              'starting 2',
              'finishing 2'
            ]);
            expectToBeCalled(function () { t(3); });
          }).then(function () {
            return promise;
          }).then(function () {
            return wait(1);
          }).then(function () {
            expect(values).to.eql([
              'starting 1',
              'finishing 1',
              'starting 2',
              'finishing 2',
              'starting 3',
              'finishing 3',
            ]);
          });
        });
      });
    });
  });

  describe('equality', function () {
    function expectDifferent(a, b) {
      var called = 0;

      var t = throttle({throttle: 0}, function () {
        called++;
      });

      t.apply(undefined, a);
      t.apply(undefined, b);

      expect(called, 'expected ' + a + ' and ' + b + ' to be considered different').to.equal(2);
    }

    function expectSame(a, b) {
      var called = 0;

      var t = throttle({throttle: 0}, function () {
        called++;
      });

      t.apply(undefined, a);
      t.apply(undefined, b);

      expect(called, 'expected ' + a + ' and ' + b + ' to be considered the same').to.equal(1);
    }

    it('numbers', function () {
      expectDifferent([1], [2]);
      expectSame([1], [1]);
    });

    it('strings', function () {
      expectDifferent(["a"], ["b"]);
      expectSame(["a"], ["a"]);
    });

    it('strings are different to numbers', function () {
      expectDifferent(["1"], [1]);
    });

    it('booleans', function () {
      expectDifferent([true], [false]);
      expectSame([true], [true]);
    });

    it('dates', function () {
      expectDifferent([new Date(2013, 1, 2)], [new Date(2013, 1, 3)]);
      var d = new Date(2013, 1, 2);
      expectSame([d], [d]);
    });

    it('objects', function () {
      expectDifferent([{value: '1'}], [{value: '1'}]);
      var obj = {value: '1'}
      expectSame([obj], [obj]);
    });

    it('arrays', function () {
      expectDifferent([[1]], [[1]]);
      var a = [1];
      expectSame([a], [a]);
    });

    it('multiple values', function () {
      expectDifferent([1, 2], [1]);
      expectDifferent([1, 2], [1, 3]);
      expectSame([1, 2], [1, 2]);
    });

    it('no arguments are considered different', function () {
      expectDifferent([], []);
    });

    it('undefined', function () {
      expectSame([undefined], [undefined]);
    });
  });
});

function wait(n) {
  return new Promise(function (done) {
    setTimeout(done, n);
  });
}
