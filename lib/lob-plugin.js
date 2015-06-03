'use strict';

var LargeObjectManager = require('pg-large-object').LargeObjectManager;

function lobManager(sequelize, t) {
    return sequelize.Promise.promisifyAll(new LargeObjectManager(t.connection));
}

function createLob() {
    var self = this;

    return this.requiresTransaction(function (t) {
        return lobManager(self, t).createAsync();
    });
}

function readLob(oid, writable) {
    var self = this;

    return this.requiresTransaction(function (t) {
        return lobManager(self, t).openAsync(oid, LargeObjectManager.READ)
            .then(function (lo) {
                return new self.Promise(function (resolve, reject) {
                    lo.getReadableStream().pipe(writable)
                        .on('finish', resolve)
                        .on('error', reject);
                }).finally(lo.close.bind(lo));
            })
    });
}

function writeLob(oid, readable) {
    var self = this;

    return this.requiresTransaction(function (t) {
        return lobManager(self, t).openAsync(oid, LargeObjectManager.WRITE)
            .then(function (lo) {
                return new self.Promise(function (resolve, reject) {
                    var writable = lo.getWritableStream();
                    writable.on('finish', resolve)
                        .on('error', reject);

                    readable.pipe(writable);
                }).finally(lo.close.bind(lo));
            });
    });
}

function unlinkLob(oid) {
    var self = this;

    return this.requiresTransaction(function (t) {
        return lobManager(self, t).unlinkAsync(oid);
    });
}

exports.createLob = createLob;
exports.readLob = readLob;
exports.writeLob = writeLob;
exports.unlinkLob = unlinkLob;