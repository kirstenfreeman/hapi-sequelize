'use strict';

var _ = require('lodash');

module.exports = _.curry(function (sequelize) {
    return {
        Foo: require('./foo')(sequelize),
        Bar: require('./bar')(sequelize),
        TestBaz: require('./test-baz')(sequelize),
        TestBlah: require('./test-blah')(sequelize),
        UpsertModel: require('./upsert-model')(sequelize),
        MultipartUpsertModel: require('./multipart-upsert-model')(sequelize)
    };
});