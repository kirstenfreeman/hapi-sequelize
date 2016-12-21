'use strict';

const _ = require('lodash');
const joi = require('joi');

const internals = {};

internals.schema = {
    modelName: joi.string().default('TableLog'),
    tableName: joi.string().default('table_log')
};

internals.createModel = function(sequelize, opts) {
    var DataTypes = sequelize.Sequelize;

    return sequelize.define(opts.modelName, {
        id: { type: DataTypes.STRING, primaryKey: true },
        updatedAt: DataTypes.DATE
    }, { tableName: opts.tableName, timestamps: false })
};

internals.createLogFn = function(sequelize, logTable) {
    return sequelize.query(`CREATE OR REPLACE FUNCTION update_table_log(TABLE_NAME) RETURNS TRIGGER AS $$ BEGIN INSERT INTO ${logTable} (id, "updatedAt") VALUES (TABLE_NAME, NOW()) ON CONFLICT (id) DO UPDATE SET "updatedAt" = NOW(); RETURN NEW; END; $$ language plpgsql;`)
};

internals.dropTrigger = function(sequelize, modelTable) {
    return sequelize.query(`DROP TRIGGER IF EXISTS log_update ON ${modelTable}`);
};

internals.createTrigger = function(sequelize, modelTable) {
    return sequelize.query(`CREATE TRIGGER log_update AFTER INSERT OR UPDATE OR DELETE ON ${modelTable} FOR EACH ROW EXECUTE PROCEDURE update_table_log('${modelTable}')`);
};

module.exports = function(opts = {}) {
    opts = joi.attempt(opts, internals.schema);

    return function(model) {
        const sequelize = model.sequelize;
        const tableName = model.options.tableName;

        if (!sequelize.models[opts.schema]) internals.createModel(sequelize, opts);

        model.afterSync(function () {
            return internals.createLogFn(sequelize, opts.tableName)
                .then(() => internals.dropTrigger(sequelize, tableName))
                .then(() => internals.createTrigger(sequelize, tableName));
        });
    }
};