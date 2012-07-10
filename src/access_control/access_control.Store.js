// TODO Use absence of matching guard flags to block reads and writes that did
// not declare any access controls matching the given payload
var eventRegExp = require('../path').eventRegExp
  , transaction = require('../transaction')
  , createMiddleware = require('../middleware')
  ;

exports = module.exports = {
  type: 'Store'
, events: {
    init: function (store) {
      store.eachContext(function (context) {
        context.guardReadPath = createMiddleware();
        context.guardQueries   = createMiddleware();
        context.guardWrites    = createMiddleware();

        var _grp_ = context.guardReadPath;
        context.guardReadPath = function (req, res, next) {
          context.guardReadPath.add( function (req, res, next) {
            if (! req.didMatchAGuard)
              return res.fail('Unauthorized: No access control declared for path ' + req.target);
            next();
          });
          context.guardReadPath = _grp_;
          context.guardReadPath(req, res, next);
        };
        context.guardReadPath.add = _grp_.add;
      });
    }

  }
, proto: {
    /**
     * Declare access controls for reading paths and path patterns
     *
     * store.readPathAccess('users.*', function (id, next) {
     *   var session = this.session;
     *   store.get('users.' + session.userId, function (err, user) {
     *     next(user.friendIds.indexOf(id) !== -1);
     *   });
     * });
     *
     * @param {String} path representing the path pattern
     * @param {Function} callback(captures..., next)
     * @return {Store} the store for chaining
     * @api public
     */
    readPathAccess: function (path, callback) {
      var context = this.currContext;
      var fn = createPathGuard(path, callback);
      context.guardReadPath.add(fn);
      return this;
    }

    /**
     * Declare access controls for querying.
     *
     * store.queryAccess('users', 'friendsOf', function (userId) {
     *   var session = this.session;
     *   store._fetchQueryData(['users', 'friendsOf', userId]
     * });
     *
     * @param {String} ns is the collection namespace
     * @param {String} motif is the name of the query motif
     * @param {Function} callback
     * @return {Store} the store for chaining
     * @api public
     */
  , queryAccess: function (ns, motif, callback) {
      var context = this.context(this.currContext);
      var fn = createQueryGuard(ns, motif, callback);
      context.guardQueries.add(fn);
      return this;
    }

    /**
     * Declare write access controls
     * @param {String} mutator method name
     * @param {String} target path pattern (or query)
     * @param {Function} callback(captures..., txnArgs..., next)
     * @return {Store} the store for chaining
     * @api public
     */
  , writeAccess: function (mutator, target, callback) {
      var context = this.context(this.currContext);
      var fn = createWriteGuard(mutator, target, callback);
      context.guardWrites.add(guard);
      return this;
    }
  }
};

/**
 * Returns a guard function (see JSDoc inside this function for details) that
 * enables the store to guard against unauthorized access to paths that match
 * pattern. The logic that determines who has access or not is defined by callback.
 *
 * @param {String} pattern
 * @param {Function} callback
 * @return {Function}
 * @api private
 */
function createPathGuard (pattern, callback) {
  var regexp = eventRegExp(pattern);

  /**
   * Determines whether a client (represented by req.session) should be able to
   * retrieve path via Model#subscribe or Model#fetch. If the client is allowed
   * to, then next(). Otherwise res.fail('Unauthorized')
   * @param {Object} req
   * @param {String} res
   * @param {Function} next
   */
  function guard (req, res, next) {
    var session = req.session
      , path = req.target;
    if (!regexp.test(path)) return next();
    req.didMatchAGuard = true
    var captures = regexp.exec(path).slice(1)
      , caller = {session: session};
    callback.apply(caller, captures.concat([function (isAllowed) {
      if (!isAllowed) return res.fail('Unauthorized');
      return next();
    }]));
  }

  return guard;
}

function createQueryGuard (ns, motif, callback) {
  /**
   * Determines whether a client (represented by req.session) should be able to
   * retrieve the query represented by req.queryTuple via Model#subscribe or
   * Model#fetch. If the client is allowed to, then next().
   * Otherwise res.fail('Unauthorized');
   */
  function guard (req, res, next) {
    var queryTuple = req.queryTuple
      , queryNs = queryTuple[0]
      , motifs = queryTuple[1];

    if (ns !== queryNs) return next();
    var matchingMotif;
    for (var motifName in motifs) {
      if (motifName === motif) {
        matchingMotif = motifName
        break;
      }
    }
    if (! matchingMotif) return next();

    req.matchingGuardFor || (req.matchingGuardFor = {});
    req.matchingGuardFor[matchingMotif] = true;

    var args = motifs[matchingMotif];
    var caller = {session: session};
    callback.apply(caller, args.concat([function (isAllowed) {
      if (!isAllowed) return res.fail('Unauthorized');
      return next();
    }]));
  }
  return guard;
}

function createWriteGuard (mutator, target, callback) {
  var regexp = eventRegExp(target);

  function guard (req, res, next) {
    var txn = req.data;
    var path = transaction.getPath(txn);
    if (! regexp.test(path)) return next();

    req.didMatchAGuard = true;

    var captures = regexp.exec(path).slice(1);
    var args = transaction.getArgs(txn);

    var caller = {session: req.session};

    callback.apply(caller, captures.concat(args).concat([function (isAllowed) {
      if (!isAllowed) return res.fail('Unauthorized');
      return next();
    }]));

    var allow = callback.apply(caller, captures.concat(args));
    if (allow) next();
    else res.fail('Unauthorized');
  }

  return guard;
}
