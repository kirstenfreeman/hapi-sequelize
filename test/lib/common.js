'use strict';

var db = require('../db');
var su = require('../../lib');
var sequelize = exports.sequelize = db.sequelize;

exports.models = require('../test-models')(sequelize);

//create associations after all models are defined
su.associate(sequelize);

// chai assertions
exports.sinon = require('sinon');
var chai = exports.chai = require('chai');
chai.use(require('sinon-chai'));
exports.should = chai.should();
exports.expect = chai.expect;

//always sync the db prior to running a test
beforeEach(function () {
    return sequelize.sync({ force: true });
});