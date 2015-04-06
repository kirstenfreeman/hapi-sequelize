'use strict';

var $ = require('./common');
var should = $.should;
var Foo = $.models.Foo;

/**
 * Postgres 9.4+ is required
 *
 * prior to running test:
 *      - need user 'test'
 *      - need postgres db 'hapi_sequelize'
 *      - need connect permission configured for user/database on postgres db server
 *
 * 1) at a terminal (ubuntu):
 *      sudo -u postgres createuser -D -A -P test
 *              (no password when prompted)
 *      sudo -u postgres createdb -O test hapi_sequelize
 *
 * 2) in your pg_hba.conf:
 *      - add entry under local:
 *          local	hapi_sequelize	test									trust
 *      - add entry under IPv4 local connections:
 *          host	hapi_sequelize	test			127.0.0.1/32			trust
 */
describe('restore defaults plugin', function () {
    var foo;

    it('should allow updating an existing attribute with null and clear its changes', function () {
        return Foo.create({
            id: 'myFoo',
            immutableAttr: 'immutable'
        })
            .then(function () {
                return Foo.find({where: {id: 'myFoo'}});
            })
            .then(function (f) {
                foo = f;
                should.exist(foo);
                should.not.exist(foo._changes);
                should.not.exist(foo.name);
                return foo.updateAttributes({name: 'The Foo'});
            })
            .then(function () {
                return foo.reload();
            })
            .then(function () {
                should.exist(foo.name);
                should.exist(foo._changes);
                foo.name.should.equal('The Foo');
                foo._changes.should.be.an('Object');
                foo._changes.should.have.deep.property('current.name', 'The Foo');
                foo._changes.should.have.deep.property('original.name', null);
                return Foo.find({where: {id: 'myFoo'}});
            })
            .then(function (res) {
                foo = res;
                return foo.updateAttributes({name: null});
            })
            .then(function () {
                return foo.reload();
            })
            .then(function () {
                should.not.exist(foo.name);
                should.not.exist(foo._changes);
            });
    });
});