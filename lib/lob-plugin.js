'use strict';

var _ = require('lodash');
var LargeObjectManager = require('pg-large-object').LargeObjectManager;
var stream = require('stream');

function lobManager(sequelize, t) {
    return sequelize.Promise.promisifyAll(new LargeObjectManager(t.connection));
}

function createLob(sequelize) {
    return sequelize.requiresTransaction(function (t) {
        return lobManager(sequelize, t).createAsync();
    });
}

function readLob(sequelize, oid, writable) {
    return sequelize.requiresTransaction(function (t) {
        return lobManager(sequelize, t).openAsync(oid, LargeObjectManager.READ)
            .then(function (lo) {
                return new sequelize.Promise(function (resolve, reject) {
                    lo.getReadableStream().pipe(writable)
                        .on('finish', resolve)
                        .on('error', reject);
                }).finally(lo.close.bind(lo));
            })
    });
}

function writeLob(sequelize, oid, readable) {
    return sequelize.requiresTransaction(function (t) {
        return lobManager(sequelize, t).openAsync(oid, LargeObjectManager.WRITE)
            .then(function (lo) {
                return new sequelize.Promise(function (resolve, reject) {
                    var writable = lo.getWritableStream();
                    writable.on('finish', resolve)
                        .on('error', reject);

                    readable.pipe(writable);
                }).finally(lo.close.bind(lo));
            });
    });
}

function unlinkLob(sequelize, oid) {
    return sequelize.requiresTransaction(function (t) {
        return lobManager(sequelize, t).unlinkAsync(oid);
    });
}

module.exports = function (sequelize) {
    sequelize.createLob = createLob.bind(null, sequelize);
    sequelize.readLob = readLob.bind(null, sequelize);
    sequelize.writeLob = writeLob.bind(null, sequelize);
    sequelize.unlinkLob = unlinkLob.bind(null, sequelize);
};