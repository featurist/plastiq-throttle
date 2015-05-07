var chai = require('chai');
var expect = chai.expect;
var watch = require('..');
var plastiq = require('plastiq');
var h = plastiq.html;

describe('watch', function () {
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
      var w;

      beforeEach(function () {
        w = watch(function (n) {
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
        expectToBeCalled(function () { w(1); });
        expect(value).to.equal(1);
      });

      it("isn't run the second time", function () {
        expectToBeCalled(function () { w(1); });
        expectNotToBeCalled(function () { w(1); });
        expect(value).to.equal(1);
      });

      it("is run the second time if the value is different", function () {
        expectToBeCalled(function () { w(1); });
        expectToBeCalled(function () { w(2); });
        expect(value).to.equal(2);
      });

      it("is not run the third time if the value is the same as the second", function () {
        expectToBeCalled(function () { w(1); });
        expectToBeCalled(function () { w(2); });
        expectNotToBeCalled(function () { w(2); });
        expect(value).to.equal(2);
      });

      it("is run the third time if the value is same as first", function () {
        expectToBeCalled(function () { w(1); });
        expectToBeCalled(function () { w(2); });
        expectToBeCalled(function () { w(1); });
        expect(value).to.equal(1);
      });
    });

    context('with throttling', function () {
      var throttle = 10;

      beforeEach(function () {
        calledRefresh = false;
        called = 0;

        w = watch({throttle: throttle}, function (n) {
          value = n;
          called++;
        });
      });

      it('runs the first time', function () {
        expectToBeCalled(function () { w(1); });
        expect(value).to.equal(1);
      });

      it("doesn't run the second time if the value is the same", function () {
        expectToBeCalled(function () { w(1); });
        expectNotToBeCalled(function () { w(1); });

        return wait(throttle * 2).then(function () {
          expect(called).to.equal(1);
          expect(calledRefresh).to.be.false;
        });
      });

      it('runs the second time if the value is different, but delayed', function () {
        return new Promise(function (done) {
          h.refresh = done;

          expectToBeCalled(function () { w(1); });
          expectNotToBeCalled(function () { w(2); });
        }).then(function () {
          expect(value).to.equal(2);
        });
      });

      it("when throttled, doesn't run intermediate values, only the last", function () {
        return new Promise(function (done) {
          h.refresh = done;

          expectToBeCalled(function () { w(1); });
          expectNotToBeCalled(function () { w(2); });
          expectNotToBeCalled(function () { w(3); });
          expectNotToBeCalled(function () { w(4); });
          expectNotToBeCalled(function () { w(5); });
        }).then(function () {
          expect(value).to.equal(5);
          expect(called).to.equal(2);
        });
      });
    });
  });

  describe('asynchronous actions', function () {
    context('without throttle', function () {
      var w;
      var values;

      beforeEach(function () {
        values = [];

        w = watch(function (n) {
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

          expectToBeCalled(function () { w(1); });
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
          expectToBeCalled(function () { w(1); });
        }).then(function () {
          return new Promise(function (done) {
            expect(values).to.eql([
              'starting 1',
              'finishing 1'
            ]);

            h.refresh = done;
            expectToBeCalled(function () { w(2); });
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

          expectToBeCalled(function () { w(1); });
          expectNotToBeCalled(function () { w(1); });
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

          expectToBeCalled(function () { w(1); });
          expectNotToBeCalled(function () { w(2); });
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

          expectToBeCalled(function () { w(1); });
          expectNotToBeCalled(function () { w(2); });
          expectNotToBeCalled(function () { w(3); });
          expectNotToBeCalled(function () { w(4); });
          expectNotToBeCalled(function () { w(5); });
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
      var throttle = 20;
      var values;
      var promise;
      var promiseDuration;

      beforeEach(function () {
        called = 0;
        values = [];
        promiseDuration = 0;

        w = watch({throttle: throttle}, function (n) {
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
          expectToBeCalled(function () { w(1); });
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1'
          ]);
        });
      });

      it("skips calls if they are within the throttle, but always runs the last", function () {
        return new Promise(function (done) {
          h.refresh = done;
          expectToBeCalled(function () { w(1); });
        }).then(function () {
          return wait(1);
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1',
          ]);
          expectNotToBeCalled(function () { w(2); });
        }).then(function () {
          return wait(1);
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1',
          ]);
          expectNotToBeCalled(function () { w(3); });
        }).then(function () {
          return wait(1);
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1',
          ]);
          expectNotToBeCalled(function () { w(4); });
        }).then(function () {
          return wait(1);
        }).then(function () {
          return new Promise(function (done) {
            h.refresh = done;

            expect(values).to.eql([
              'starting 1',
              'finishing 1',
            ]);
            expectNotToBeCalled(function () { w(5); });
          });
        }).then(function () {
          expect(values).to.eql([
            'starting 1',
            'finishing 1',
            'starting 5',
            'finishing 5'
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
            expectToBeCalled(function () { w(1); });
          }).then(function () {
            return promise;
          }).then(function () {
            return wait(1);
          }).then(function () {
            expect(values).to.eql([
              'starting 1',
              'finishing 1'
            ]);
            expectToBeCalled(function () { w(2); });
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
            expectToBeCalled(function () { w(3); });
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
});

function wait(n) {
  return new Promise(function (done) {
    setTimeout(done, n);
  });
}
