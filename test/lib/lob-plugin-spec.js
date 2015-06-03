'use strict';

var chai = require('chai');
var should = chai.should();
var lobPlugin = require('../../lib/lob-plugin');
var stream = require('stream');
var $ = require('./common');
var P = $.sequelize.Promise;

lobPlugin($.sequelize);

describe.only('LobPlugin', function () {
    it('should create a lob', function () {
        return $.sequelize.createLob()
            .then(function (lob) {
                should.exist(lob);
                return $.sequelize.unlinkLob(lob);
            });
    });

    describe('when a lob exists', function () {
        var lobId;

        beforeEach(function () {
            return $.sequelize.createLob()
                .then(function (res) {
                    lobId = res;
                });
        });

        afterEach(function () {
            return $.sequelize.unlinkLob(lobId);
        });

        it('should write a stream to it', function () {
            var readStream = new stream.Readable();
            readStream._read = function() {
                this.push('this is a test');
                this.push();
            };

            return $.sequelize.writeLob(lobId, readStream);
        });

        it('should read a stream from it', function () {
            var readStream = new stream.Readable();
            readStream._read = function() {
                this.push('this is a test');
                this.push();
            };

            var writeStream = new stream.Writable();
            writeStream.bufs = [];
            writeStream._write = function (chunk, enc, done) {
                this.bufs.push(chunk);
                done();
            };

            writeStream.result = function () {
                return Buffer.concat(this.bufs);
            };

            return $.sequelize.writeLob(lobId, readStream)
                .then(function () {
                    return $.sequelize.readLob(lobId, writeStream);
                })
                .then(function () {
                    writeStream.result().toString().should.equal('this is a test');
                });
        });
    });
});