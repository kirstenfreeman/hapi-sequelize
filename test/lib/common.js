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
    return sequelize.sync({ force: true });
});