'use strict';

var _ = require('lodash');
var joi = require('joi');
var boom = require('boom');
var eu = require('ent-utils');
var Sequelize = require('sequelize');

var internals = {};

/**
 * Default pre-query lifecycle method. This method may change the query via side effect only. Return values
 * are ignored
 * @param {Object} request the hapi request
 * @param {Object} query the compiled query options to be sent to sequelize
 */
internals.defaultPreLookup = function(request, query) {
};

/**
 * Default post-query lifecycle method. This method may change the query via side effect only. Return values
 * are ignored
 * @param {Object} request the hapi request
 * @param {Object} result the found entity
 * @param {Object} reply the hapi reply
 */
internals.defaultPostLookup = function(request, result, reply) {
};

/**
 * Default where builder implementation
 * @param {Object} request the hapi request
 */
internals.defaultWhere = function(request) {
    return request.params;
};

/**
 * Default required expansions implementation
 * @param {Object} request the hapi request
 * @param {Object} Model the sequelize model
 * @return {Array}
 */
internals.defaultRequiredExpansions = function(request, Model) {
    return [];
};

/**
 * Creates a joi validation object for the route definition based on registered joi models
 * Note: This means that sequelize models should be registered before dependent route handlers
 * @param {Object} sequelize the sequelize instance
 * @return {Object} a joi schema for validating route options
 */
internals.optionsSchema = function (sequelize) {
    return {
        model: joi.string().required().valid(_.keys(sequelize.models)),
        where: joi.func().default(internals.defaultWhere),
        expand: joi.object().keys({
            required: joi.alternatives([
                joi.array().single().includes(joi.string()),
                joi.func()
            ]).default(internals.defaultRequiredExpansions),
            valid: joi.array().includes(joi.string()).single(),
            invalid: joi.array().includes(joi.string()).single()
        }).default({ required: internals.defaultRequiredExpansions }),
        preLookup: joi.func().default(internals.defaultPreLookup),
        postLookup: joi.func().default(internals.defaultPostLookup)
    };
};

/**
 * Creates a joi validation object for validating the http request's query parameters
 * @param Model
 * @param options
 */
internals.routeQuerySchema = function(Model, options) {
    var schema = {};

    var associations = options.expand.valid || Object.keys(Model.associations || {});

    // strip out invalid asosciations
    associations = _.difference(associations, options.expand.invalid);

    schema.expand = joi.array().single().includes(joi.string().valid(associations)).default([]);

    if (associations.length === 0) schema.expand = schema.expand.forbidden();

    return schema;
};

/**
 * Merges the query schema with any existing route validation. If no existing validation, the query validation
 * is returned
 * @param {Object} schemas the value of route.settings.validate
 * @param {Object} Model the sequelize model
 * @param {Object} options the route options
 * @return {Object} the combined joi schema
 */
internals.mergeRouteValidationSchemas = function(schemas, Model, options) {
    var querySchema = internals.routeQuerySchema(Model, options);

    schemas = _.merge({}, schemas);

    schemas.query = schemas.query ? joi.compile(schemas.query).concat(joi.compile(querySchema)) : joi.compile(querySchema);

    return schemas;
};

/**
 * Builds an array of associations to include. The array is seeded by invoking the route's expand.required() method
 * @param req
 * @param Model
 * @param options
 * @return {*}
 */
internals.getIncludes = function (req, Model, options) {
    // joi will sanitize undefined query parameter into an empty array
    var expansions = req.query.expand;

    return []
        .concat(options.expand.required(req, Model))
        .concat(expansions.map(function(expansion) {
            return Model.associations[expansion];
        }));
};

/**
 * Builds the sequelize query options object
 * @param {Object} req the hapi request
 * @param {Object} Model the sequelize model
 * @param {Object} options the route options
 * @return {{ where: *, include: []= }} the query options
 */
internals.queryOptions = function(req, Model, options) {
    var queryOpts = { where: options.where(req) };

    var includes = internals.getIncludes(req, Model, options);
    if (includes.length > 0) queryOpts.include = includes;

    return queryOpts;
};

/**
 * Post joi type coersion of route options
 * @param Model
 * @param options
 * @return {*}
 */
internals.processValidatedOptions = function(Model, options) {
    // compose a function out of array literals
    var required = options.expand.required;
    if (_.isArray(required)) {
        required = required.map(function(association) {
            return Model.associations[association];
        });
        // options.expand.required = () => required    some day :(
        options.expand.required = function() {
            return required;
        };
    }
    return options;
};

/**
 * Creates a Hapi route handler for looking up a sequelize model. Supports an expand query parameter for eagerly
 * loading defined sequelize relationships. Routes should anticipate expansions and define hal _embeds accordingly
 *
 * A curried version of this function is passed to the hapi server.handler() function with a partially applied
 * sequelize reference
 * @param {Object} sequelize the sequelize instance
 * @param route
 * @param options
 */
internals.createHandler = function(sequelize, route, options) {
    var Model;

    joi.validate(options, internals.optionsSchema(sequelize), function (err, validated) {
        if (err) throw new Error('Error in route ' + route.path + ': ' + err.message);

        // the sequelize model
        Model = sequelize.models[validated.model];

        options = internals.processValidatedOptions(Model, validated);
    });

    // combine joi schemas or apply the default query schema
    route.settings.validate = internals.mergeRouteValidationSchemas(route.settings.validate, Model, options);

    return function(req, reply) {
        // compile the options
        Sequelize.Promise.resolve(internals.queryOptions(req, Model, options))

            // tweak the options if necessary before querying
            .tap(options.preLookup.bind(null, req))

            // invoke the model finder
            .then(function(options) {
                return Model.find(options);
            })

            // possible 404
            .then(function(instance) {
                if (!instance) throw boom.notFound();

                return instance;
            })

            // tweak the output
            .tap(function(instance) {
                return options.postLookup(req, instance, reply);
            })

            .then(function(instance) {
                process.nextTick(function () {
                    if (!req.response) reply(null, instance);
                });
            })

            .catch(reply);
    };
};

module.exports = _.curry(internals.createHandler);