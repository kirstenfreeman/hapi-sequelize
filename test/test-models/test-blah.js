'use strict';

module.exports = function (sequelize) {
    const DataTypes = sequelize.Sequelize;
    
    return sequelize.define('TestBlah', {
        id: { type: DataTypes.STRING, primaryKey: true },
        parentId: { type: DataTypes.INTEGER, allowNull: false },
        optionalId: DataTypes.STRING,
        bazId: { type: DataTypes.STRING, allowNull: false },
        blahId: { type: DataTypes.STRING, allowNull: false },
        bazPath: DataTypes.STRING
    }, {
        tableName: 'test_blah',
        timestamps: false,
        getterMethods: {
            id() {
                return this.getDataValue('id') || [this.parentId].concat([].concat(this.optionalId || [], this.bazId)
                        .join('+'), this.blahId).join(':');
            },
            bazPath() {
                return [this.parentId].concat([].concat(this.optionalId || [], this.bazId).join('+')).join(':');
            }
        },
        associate(models) {
            this.belongsTo(models.TestBaz, { as: 'testBaz', foreignKey: 'bazPath', onDelete: 'cascade' });
        }
    })
        .hook('beforeValidate', function (blah) {
            blah.setDataValue('id', blah.id);
            blah.setDataValue('bazPath', blah.bazPath);
        });
};