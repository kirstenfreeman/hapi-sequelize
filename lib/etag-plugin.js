'use strict';

const internals = {};

internals.createEtagFn = function (sequelize, tableName, sequences) {
    return sequelize.query(`
        CREATE OR REPLACE FUNCTION ${tableName}_update_etag() RETURNS TRIGGER AS 
        $$ 
        DECLARE
            etag bigint;
        BEGIN 
            SELECT ${sequences.map(s => `nextval('${s}_etag')`).join(', ')} INTO etag; 
            RETURN NEW; 
        END; 
        $$ 
        language plpgsql;
    `);
};

internals.dropTrigger = function (sequelize, modelTable) {
    return sequelize.query(`DROP TRIGGER IF EXISTS etag_update ON "${modelTable}"`);
};

internals.createTrigger = function (sequelize, modelTable) {
    return sequelize.query(`CREATE TRIGGER etag_update AFTER INSERT OR UPDATE OR DELETE ON "${modelTable}" FOR EACH ROW EXECUTE PROCEDURE ${modelTable}_update_etag()`);
};

internals.createSequences = function (sequelize, sequences) {
    return sequelize.Promise.all(sequences.map(s => sequelize.query(`CREATE SEQUENCE IF NOT EXISTS ${s}_etag`)));
};

module.exports = function (...sequences) {

    return function (model) {
        const sequelize = model.sequelize;
        const tableName = model.options.tableName;
        model.afterSync(function () {
            return internals.createSequences(sequelize, sequences)
                .then(() => internals.createEtagFn(sequelize, tableName, sequences))
                .then(() => internals.dropTrigger(sequelize, tableName))
                .then(() => internals.createTrigger(sequelize, tableName));
        });
    };
};