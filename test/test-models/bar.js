'use strict';

module.exports = function (sequelize) {
    const DataTypes = sequelize.Sequelize;

    const attributes = {
        id: { type: DataTypes.STRING, primaryKey: true },
        name: DataTypes.STRING,
        data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        birthday: { type: DataTypes.DATE, allowNull: false }
    };

    const options = {
        tableName: 'bars',
        timestamps: true,
        indexes: [
            { name: 'bar_name', fields: ['name'] }
        ]
    };

    return sequelize.define('Bar', attributes, options);
};