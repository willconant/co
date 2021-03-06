
/**
 * Expose `co`.
 */

exports = module.exports = co;

/**
 * Wrap the given generator `fn`.
 *
 * @param {Function} fn
 * @return {Function}
 * @api public
 */

function co(fn) {
  var gen = fn();
  var done;

  function next(err, res) {
    var ret;

    // multiple args
    if (arguments.length > 2) {
      res = [].slice.call(arguments, 1);
    }

    // error
    if (err) {
      try {
        ret = gen.throw(err);
      } catch (e) {
        if (!done) throw e;
        return done(e);
      }
    }

    // ok
    if (!err) {
      try {
        ret = gen.send(res);
      } catch (e) {
        if (!done) throw e;
        return done(e);
      }
    }

    // done
    if (ret.done) {
      if (done) done(null, ret.value);
      return;
    }

    if ('function' == typeof ret.value) {
      // thunk
      try {
        ret.value(next);
      } catch (e) {
        setImmediate(function(){
          next(e);
        });
      }
    } else if ('object' == typeof ret.value && 'function' == typeof ret.value.then) {
      // promise
      ret.value.then(function(value) {
          next(null, value);
        },
        next);
    } else {
      // neither
      next(new Error('yielded neither a function nor a promise'));
    }
  }

  setImmediate(next);

  return function(fn){
    done = fn;
  }
}

/**
 * Wrap regular callback style `fn` as a thunk.
 *
 * @param {Function} fn
 * @return {Function}
 * @api public
 */

exports.wrap = function(fn, ctx){
  return function(){
    var args = [].slice.call(arguments);
    return function(done){
      args.push(done);
      fn.apply(ctx || this, args);
    }
  }
};

/**
 * Join the given `fns`.
 *
 * @param {Array|Function} ...
 * @return {Function}
 * @api public
 */

exports.join = function(fns) {
  if (!Array.isArray(fns)) fns = [].slice.call(arguments);

  return function(done){
    var pending = fns.length;
    var results = new Array(pending);
    var finished;

    if (!pending) return done();

    for (var i = 0; i < fns.length; i++) {
      run(fns[i], i);
    }

    function run(fn, i) {
      if (finished) return;
      try {
        fn(function(err, res){
          if (finished) return;

          if (err) {
            finished = true;
            return done(err);
          }

          results[i] = res;
          --pending || done(null, results);
        });
      } catch (err) {
        finished = true;
        done(err);
      }
    }
  }
};
