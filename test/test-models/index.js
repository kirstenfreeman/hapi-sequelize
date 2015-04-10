'use strict';

var _ = require('lodash');

module.exports = _.curry(function (sequelize) {
    return {
        Foo: require('./foo')(sequelize)
    };
});