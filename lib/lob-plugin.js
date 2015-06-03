'use strict';

var LargeObjectManager = require('pg-large-object').LargeObjectManager;

function lobManager(sequelize, t) {
    return sequelize.Promise.promisifyAll(new LargeObjectManager(t.connection));
}

function lobCreate() {
    var self = this;

    return this.requiresTransaction(function (t) {
        return lobManager(self, t).createAsync();
    });
}

function lobRead(oid, writable) {
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

function lobWrite(oid, readable) {
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

function lobUnlink(oid) {
    var self = this;

    return this.requiresTransaction(function (t) {
        return lobManager(self, t).unlinkAsync(oid);
    });
}

function lobTruncate(oid){
    var self = this;

    return this.requiresTransaction(function (t) {
        return lobManager(self, t).openAsync(oid, LargeObjectManager.WRITE)
            .then(function (lo) {
                return new self.Promise(function (resolve, reject) {
                    lo.truncate(0, function (err) {
                        if (err) return reject(err);
                        resolve();
                    });
                })
            });
    });
}

function lobSize(oid) {
    var self = this;

    return this.requiresTransaction(function (t) {
        return lobManager(self, t).openAsync(oid, LargeObjectManager.READ)
            .then(function (lo) {
                return new self.Promise(function (resolve, reject) {
                    lo.size(function (err, size) {
                        if (err) return reject(err);

                        try {
                            resolve(parseInt(size));
                        } catch (err) {
                            reject(err);
                        }
                    });
                });
            });
    });
}

exports.lobCreate = lobCreate;
exports.lobSize = lobSize;
exports.lobRead = lobRead;
exports.lobWrite = lobWrite;
exports.lobUnlink = lobUnlink;
exports.lobTruncate = lobTruncate;