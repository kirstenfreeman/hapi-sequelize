'use strict';

const db = require('../db');
const su = require('../../lib');
const sequelize = exports.sequelize = db.sequelize;

exports.models = require('../test-models')(sequelize);

//create associations after all models are defined
su.associate(sequelize);
su.enableLobSupport();

sequelize.patchUpsert();
// chai assertions
exports.sinon = require('sinon');
const chai = exports.chai = require('chai');
chai.use(require('sinon-chai'));
exports.should = chai.should();
exports.expect = chai.expect;

//always sync the db prior to running a test
beforeEach(function () {
    return sequelize.query(
        `
             CREATE OR REPLACE FUNCTION jsonb_deep_merge(original jsonb, current jsonb)
             RETURNS JSONB LANGUAGE SQL AS $$
             SELECT
             jsonb_object_agg(
                 coalesce(oKey, cKey),
                 case
                     WHEN oValue isnull THEN cValue
                     WHEN cValue isnull THEN oValue
                     WHEN jsonb_typeof(oValue) <> 'object' or jsonb_typeof(cValue) <> 'object' THEN cValue
                     ELSE jsonb_deep_merge(oValue, cValue) END
                 )
             FROM jsonb_each(original) e1(oKey, oValue)
             FULL JOIN jsonb_each(current) e2(cKey, cValue) ON oKey = cKey
         $$;
        `
    ).then(() => sequelize.sync({ force: true }));
});