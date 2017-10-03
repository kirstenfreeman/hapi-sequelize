'use strict';

module.exports = function (sequelize) {
    const DataTypes = sequelize.Sequelize;

    return sequelize.define('TestBaz', {
        id: { type: DataTypes.STRING, primaryKey: true },
        parentId: DataTypes.INTEGER,
        optionalId: DataTypes.STRING,
        bazId: DataTypes.STRING
    }, {
        tableName: 'test_baz',
        timesetamps: false,
        getterMethods: {
            id() {
                return this.getDataValue('id') || [this.parentId, [].concat(this.optionalId || [], this.bazId).join('+')].join(':');
            }
        },
        associate(models) {
            this.hasMany(models.TestBlah, { as: 'testBlahs', foreignKey: 'bazPath', onDelete: 'cascade' });
        }
    }).hook('beforeValidate', function (baz) {
        baz.setDataValue('id', baz.id);
    });
};