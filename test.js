'use strict';

require('should');

var validate = require('./index'),
    format = require('util').format;

function test(packages, opts, match) {
    opts = opts || { };
    opts.packages = opts.packages || [ ];
    opts.licenses = opts.licenses || [ ];
    opts.__nlf = opts.__nlf || {
        find: function (opts, cb) { cb(null, packages); },
        standardFormatter: {
            render: function (data, cb) {
                var pkgstr = packages.map(function (def) {
                    return format('%s [license(s): %s]', def.pkg, def.licenses.join(', '));
                }).join('\n');
                
                cb(null, pkgstr);
            }
        }
    };
    validate(__dirname, opts, function (err, res) {
        if (!err && match) { res.should.match(match); }
    });
}

describe('NLF-validator', function () {
    it('should return invalid licenses when not included in the allowed list', function () {
        test([
            { pkg: 'foo@1.0.0', licenses: [ 'ISC', 'MIT' ] }
        ], {
            licenses: [ 'foo' ]
        }, {
            packages: { 'foo@1.0.0': 'ISC, MIT' },
            licenses: [ ],
            invalids: [ 'foo@1.0.0' ]
        });
    });
    it('should validate a simple license', function () {
        test([
            { pkg: 'foo@1.0.0', licenses: [ 'ISC' ] }
        ], {
            licenses: [ 'ISC' ]
        }, {
            licenses: [ 'ISC' ],
            invalids: [ ]
        });
    });
    it('should validate a non-spdx license', function () {
        test([
            { pkg: 'foo@1.0.0', licenses: [ 'random thing' ] }
        ], {
            licenses: [ 'random thing' ]
        }, {
            licenses: [ 'random thing' ],
            invalids: [ ]
        });
    });
    it('should return a matching license from a list of alternates', function () {
        test([
            { pkg: 'foo@1.0.0', licenses: [ 'ISC', 'MIT' ] }
        ], {
            licenses: [ 'MIT' ]
        }, {
            packages: { 'foo@1.0.0': 'MIT' },
            licenses: [ 'MIT' ],
            invalids: [ ]
        });
    });
    it('should match a composite spdx license (AND)', function () {
        test([
            { pkg: 'foo@1.0.0', licenses: [ '(ISC AND MIT)', 'ISC', 'MIT' ] }
        ], {
            licenses: [ 'ISC', 'MIT' ]
        }, {
            packages: { 'foo@1.0.0': '(ISC AND MIT)' },
            licenses: [ '(ISC AND MIT)' ],
            invalids: [ ]
        });
    });
    it('should match a composite spdx license (OR)', function () {
        test([
            { pkg: 'foo@1.0.0', licenses: [ '(GPL-2.0+ WITH Bison-exception-2.2)' ] }
        ], {
            licenses: [ '(GPL-2.0+ WITH Bison-exception-2.2)' ]
        }, {
            packages: { 'foo@1.0.0': '(GPL-2.0+ WITH Bison-exception-2.2)' },
            licenses: [ '(GPL-2.0+ WITH Bison-exception-2.2)' ],
            invalids: [ ]
        });
    });
    it('should match a composite spdx license (WITH)', function () {
        test([
            { pkg: 'foo@1.0.0', licenses: [ '(ISC OR MIT)' ] }
        ], {
            licenses: [ 'MIT' ]
        }, {
            packages: { 'foo@1.0.0': '(ISC OR MIT)' },
            licenses: [ '(ISC OR MIT)' ],
            invalids: [ ]
        });
    });
    it('should fall back on other options after a failed spdx expression', function () {
        test([
            { pkg: 'foo@1.0.0', licenses: [ '(ISC AND MIT)', 'MIT' ] }
        ], {
            licenses: [ 'MIT' ]
        }, {
            packages: { 'foo@1.0.0': 'MIT' },
            licenses: [ 'MIT' ],
            invalids: [ ]
        });
    });
    it('should allow package-specific exceptions', function () {
        test([
            { pkg: 'foo@1.0.0', licenses: [ 'GPL-2.0' ] }
        ], {
            licenses: [ 'MIT' ],
            packages: [ 'foo@1.0.0' ]
        }, {
            packages: { 'foo@1.0.0': 'GPL-2.0 (exception: foo@1.0.0)' },
            licenses: [ ],
            invalids: [ ]
        });
    });
    it('should allow package.json semver specifications', function () {
        test([
            { pkg: 'foo@1.2.0', licenses: [ 'GPL-2.0' ] }
        ], {
            licenses: [ 'MIT' ],
            packages: [ 'foo@^1.0.0' ]
        }, {
            packages: { 'foo@1.2.0': 'GPL-2.0 (exception: foo@^1.0.0)' },
            licenses: [ ],
            invalids: [ ]
        });
    });
    it('should reject failed exception version specifications', function () {
        test([
            { pkg: 'foo@1.2.0', licenses: [ 'GPL-2.0' ] }
        ], {
            licenses: [ 'MIT' ],
            packages: [ 'foo@^2.0.0' ]
        }, {
            packages: { 'foo@1.2.0': 'GPL-2.0' },
            licenses: [ ],
            invalids: [ 'foo@1.2.0' ]
        });
    });
    describe('Error cases', function () {
        it('should throw with an invalid directory', function () {
            (function () { validate(); }).should.throw(/invalid rootDir/);
        });
        it('should throw if rootDir is not a directory', function () {
            (function () { validate(__filename); }).should.throw(/not a directory/);
        });
        it('should throw if rootDir doesn\'t exist', function () {
            (function () { validate('./foo'); }).should.throw(/invalid rootDir:.* ENOENT/);
        });
        it('should throw with invalid options', function () {
            (function () { validate(__dirname); }).should.throw(/invalid options/);
        });
        it('should throw with no licenses or packages specified', function () {
            (function () { validate(__dirname, { }); }).should.throw(/no licenses or packages/);
            (function () { validate(__dirname, { licenses: [ ] }); }).should.throw(/no licenses or packages/);
            (function () { validate(__dirname, { packages: [ ] }); }).should.throw(/no licenses or packages/);
            (function () { validate(__dirname, { licenses: [ ], packages: [ ] }); }).should.throw(/no licenses or packages/);
        });
        it('should throw with no callback', function () {
            (function () { validate(__dirname, { licenses: [ 'foo' ] }); }).should.throw(/no callback specified/);
        });
        it('should call the callback with errors if one exists', function () {
            validate(null, null, function (err) {
                err.should.match(/invalid rootDir/);
            });
        });
        it('should pass on errors from nlf.find', function () {
            var err = new Error();
            
            test([
                { pkg: 'foo@1.0.0', licenses: [ ] }
            ], {
                licenses: [ 'a' ],
                __nlf: {
                    find: function (opts, cb) { cb(err); },
                }
            }, function (_err, res) {
                _err.should.equal(err);
            });
        });
        it('should fail if invalid data is returned', function () {
            test([
                { pkg: 'foo@1.0.0', licenses: [ ] }
            ], {
                licenses: [ 'a' ],
                __nlf: {
                    find: function (opts, cb) { cb(); },
                }
            }, function (err, res) {
                err.should.match(/NLF returned invalid data/);
            });
            
            test([
                { pkg: 'foo@1.0.0', licenses: [ ] }
            ], {
                licenses: [ 'a' ],
                __nlf: {
                    find: function (opts, cb) { cb(null, { }); },
                }
            }, function (err, res) {
                err.should.match(/NLF returned invalid data/);
            });
        });
        it('should fail if no licenses are found', function () {
            test([
                { pkg: 'foo@1.0.0', licenses: [ ] }
            ], {
                licenses: [ 'a' ],
                __nlf: {
                    find: function (opts, cb) { cb(null, [ ]); },
                }
            }, function (err, res) {
                err.should.match(/NLF found no licenses/);
            });
        });
        it('should pass on errors from nlf.standardFormatter.render', function () {
            var err = new Error();
            
            test([
                { pkg: 'foo@1.0.0', licenses: [ ] }
            ], {
                licenses: [ 'a' ],
                __nlf: {
                    find: function (opts, cb) { cb(null, [ 'foo' ]); },
                    standardFormatter: {
                        render: function (data, cb) { cb(err); }
                    }
                }
            }, function (_err, res) {
                _err.should.equal(err);
            });
        });
    });
    describe('Integration', function () {
        it('should fail on an invalid package (no package.json)', function (done) {
            validate(__dirname+'/node_modules', {
                licenses: [ 'MIT' ],
                packages: [ ]
            }, function (err, res) {
                err.should.match(/No package.json file found/);
                done();
            });
        });
        it('sould successfully validate this package', function (done) {
            validate(__dirname, {
                licenses: [ 'ISC', 'MIT', 'JSON', 'BSD-3-Clause' ],
                packages: [ ]
            }, function (err, res) {
                res.should.match({
                    invalids: [ ]
                });
                done();
            });
        });
    });
});
