'use strict';


var Logger = require('glib').Logger;
var log = new Logger('ent-sequelize/lib/update-handler');
var _ = require('lodash');
var joi = require('joi');
var eu = require('ent-utils');
var Boom = require('boom');
var internals = {};

/**
 * Default pre-update lifecycle method. This method may change the update via side effect only. Return values
 * are ignored
 * @param {Object} request the hapi request
 * @param {Object} query the compiled query options to be sent to sequelize
 */
internals.defaultPreUpdate = function (request, query) {
};

/**
 * Default post-update lifecycle method. This method may change the update via side effect only. Return values
 * are ignored
 * @param {Object} request the hapi request
 * @param {{start: number, total: number, count: number, items: Object[]}} result the collection object
 */
internals.defaultPostUpdate = function (request, result) {
};

/**
 * If the request has params then use them in the where by default
 * @param request hapi request
 * @returns Request params object or null if empty
 */
internals.defaultWhere = function (request) {
    return Object.keys(request.params).length > 0 ? request.params : null;
};

/**
 * Options schema to validate 
 * @param sequelize Sequelize object
 * @returns {{model: *, where: *, preUpdate: *, postUpdate: *}} options object with defaults for undefined attributes
 */
internals.optionsSchema = function (sequelize) {
    return {
        model: joi.string().required().valid(_.keys(sequelize.models)),
        where: joi.func().default(internals.defaultWhere),
        preUpdate: joi.func().default(internals.defaultPreUpdate),
        postUpdate: joi.func().default(internals.defaultPostUpdate),
        options: joi.object().default({})
    };
};

/**
 * Creates generic update handler 
 * @param sequelize Sequelize object
 * @param route Route to handle
 * @param options Options object
 * @returns {Function} Returns handler function
 */
internals.createHandler = function (sequelize, route, options) {
    joi.validate(options, internals.optionsSchema(sequelize), function (err, validated) {
        if (err) throw new Error('Error in route ' + route.path + ': ' + err.message);
        options = validated;
    });
    
    var Model = sequelize.model(options.model);

    return function (req, reply) {
        var where = options.where(req);
        
        if (!where || Object.keys(where).length === 0) {
            //If no where conditions are defined at all then findOne() would return an unpredictable result.
            throw Boom.badRequest('Request has no conditions. Results would be indeterminate.');
        }
        
        //Perform find and update within a transaction
        return sequelize.requiresTransaction(function (t) {
            return Model.findOne({ where: where, transaction: t })
                .then(function (instance) {
                    if (!instance) throw Boom.notFound();
                    return instance;
                })
                .tap(options.preUpdate.bind(null, req))
                .then(function (instance) {
                    return instance.update(req.payload, _.assign(options.options, { transaction: t }));
                })
                .tap(options.postUpdate.bind(null, req))
                .then(reply)
                .catch(reply);
        });
    };
};

module.exports = _.curry(internals.createHandler);