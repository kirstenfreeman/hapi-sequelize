'use strict';

var su = require('../../lib');

module.exports = function (sequelize) {
    var DataTypes = sequelize.Sequelize;

    var attributes = {
        // some string id
        id: {type: DataTypes.STRING, primaryKey: true},

        // some immutable attr
        immutableAttr: {type: DataTypes.STRING, allowNull: false},

        // a data field representing a name eg. 'Bar'
        name: DataTypes.STRING
    };

    var options = {
        tableName: 'foos',
        timestamps: false,
        indexes: [
            {name: 'foo_name', fields: ['name']}
        ]
    };

    return sequelize.define('Foo', attributes, options)
        .hook('beforeValidate', function (foo) {
            foo.setDataValue('immutableAttr', foo.immutableAttr);
        })
        .hook('beforeUpdate', function (foo) {
            var changes = foo.changed() || [];
            ['immutableAttr'].forEach(function (attr) {
                if (changes.indexOf(attr) >= 0) {
                    throw new Error(attr + ' is immutable');
                }
            });
        })
        .plugin(su.restoreDefaultsPlugin());
};