'use strict';

module.exports = function (sequelize) {
    const DataTypes = sequelize.Sequelize;

    const attributes = {
        // some string id
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

        naturalId1: { type: DataTypes.STRING, allowNull: false, unique: 'naturalId' },

        naturalId2: { type: DataTypes.STRING, allowNull: false, unique: 'naturalId' },

        // a data field representing a name eg. 'Bar'
        name: DataTypes.STRING,

        // a jsonb field to deep merge
        deepMerge: { type: DataTypes.JSONB, onConflict: 'DEEP_MERGE' },

        // a jsonb field to overwrite
        overwrite: { type: DataTypes.JSONB }
    };

    const options = {
        tableName: 'multipart_upsert_model',
        timestamps: false
    };

    return sequelize.define('MultipartUpsertModel', attributes, options);
};