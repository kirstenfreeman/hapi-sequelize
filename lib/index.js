'use strict';

var util = require('util');
var _ = require('lodash');
var boom = require('boom');
var joi = require('joi');
var Sequelize = require('sequelize');
var lookupHandler = require('./lookup-handler');
var queryHandler = require('./query-handler');
var removeHandler = require('./remove-handler');
var updateHandler = require('./update-handler');

exports.associate = function associate(sequelize) {
    _.forEach(sequelize.models, function (model) {
        if ('associate' in model.options) {
            model.options.associate.call(model, sequelize.models);
        }
    });
};

exports.enablePlugins = function () {
    Sequelize.Model.prototype.plugin = function (plugin) {
        plugin(this);
        return this;
    };
};

exports.enableBulkUpsert = function () {
    Sequelize.Model.prototype.bulkUpsert = function bulkUpsert(records, options) {
        var Utils = Sequelize.Utils;
        var self = this,
            createdAtAttr = this._timestampAttributes.createdAt,
            updatedAtAttr = this._timestampAttributes.updatedAt,
            now = Utils.now(self.modelManager.sequelize.options.dialect);

        // build DAOs
        var instances = records.map(function (values) {
            var instance = self.build(values, {isNewRecord: true});
            // set createdAt/updatedAt attributes
            if (createdAtAttr && !values[createdAtAttr]) {
                instance.dataValues[createdAtAttr] = now;
            }
            if (updatedAtAttr && !values[updatedAtAttr]) {
                instance.dataValues[updatedAtAttr] = now;
            }
            return instance;
        });

        options.omit = options.omit || [];

        // Create all in one query
        // Recreate records from instances to represent any changes made in hooks or validation
        records = instances.map(function (instance) {
            return _.omit(instance.dataValues, self._virtualAttributes);
        });

        var rawAttribute;

        // Map field names
        records.forEach(function (values) {
            for (var attr in values) {
                if (values.hasOwnProperty(attr)) {
                    rawAttribute = self.rawAttributes[attr];

                    // sequelize always thinks there is an id even if none is mapped
                    if (!rawAttribute) {
                        delete values[attr];
                    } else if (rawAttribute.field && rawAttribute.field !== rawAttribute.fieldName) {
                        values[self.rawAttributes[attr].field] = values[attr];
                        delete values[attr];
                    }
                }
            }
        });

        // Map attributes for serial identification
        var attributes = {};
        for (var attr in self.tableAttributes) {
            attributes[attr] = self.rawAttributes[attr];
            if (self.rawAttributes[attr].field) {
                attributes[self.rawAttributes[attr].field] = self.rawAttributes[attr];
            }
        }

        var tempTableName = this.tableName + '_' + new Date().getTime();

        var updateAttrs = _(attributes)
            .filter(function (attr) {
                return options.omit.indexOf(attr.field) < 0 && !attr.primaryKey && attr.field !== createdAtAttr;
            })
            .pluck('field')
            .map(function (fieldName) {
                return '"' + fieldName + '"';
            })
            .value();

        var lhs = updateAttrs.join(',');
        var rhs = updateAttrs.map(function (attr) {
            return 's.' + attr;
        }).join(',');

        var insertAttrs = _(attributes)
            .filter(function(attr) {
                return options.omit.indexOf(attr.field) < 0;
            })
            .map(function (attr) {
                return '"' + attr.field + '"';
            })
            .join(',');

        var updateQuery = util.format('WITH upd AS (UPDATE %s t SET (%s) = (%s) FROM %s s WHERE t.id = s.id RETURNING s.id)',
            this.tableName,
            lhs,
            rhs,
            tempTableName
        );

        var insertQuery = util.format('INSERT INTO %s(%s) SELECT %s FROM %s s LEFT JOIN upd t USING (id) WHERE t.id iS NULL',
            this.tableName,
            insertAttrs,
            insertAttrs,
            tempTableName
        );

        var upsertQuery = util.format('%s %s', updateQuery, insertQuery);

        return this.sequelize.query(util.format('CREATE TEMP TABLE %s (LIKE %s INCLUDING DEFAULTS) ON COMMIT DROP', tempTableName, this.tableName), _.merge(options, {raw: true}))
            .then(function () {
                // Insert all records at once
                return self.QueryInterface.bulkInsert(tempTableName, records, _.merge(options, {returning: false}), attributes);
            })
            .then(function () {
                return self.sequelize.query(upsertQuery, _.merge(options, {raw: true}));
            });
    };
};

exports.hasHooks = function (newInstance) {
    return function (Model) {
        Model.Instance.prototype.hooks = function hooks() {
            this._hooks = this._hooks || newInstance().curry(this);
            return this._hooks;
        };

        Model.Instance.prototype.runHook = function runHook(event) {
            return this.hooks().runHook.apply(this._hooks, arguments);
        };

        Model.Instance.prototype.on = function on(event, listener) {
            return this.hooks().on(event, listener);
        };
    };
};

exports.slug = require('./slug-plugin');

exports.history = require('./history-plugin');

/**
 *
 * @param sequelize
 * @param fn
 * @return {*}
 */
exports.requiresTransaction = function(sequelize, fn) {
    var t = Sequelize.cls && Sequelize.cls.get('transaction');
    if (t) return fn(t);
    return sequelize.transaction(fn);
};

exports.enableRequiresTransaction = function() {
    Sequelize.prototype.requiresTransaction = function(fn) {
        return exports.requiresTransaction(this, fn);
    };
};

exports.restoreDefaultsPlugin = require('./restore-defaults-plugin').restoreDefaultsPlugin;

exports.enableLobSupport = function() {
    _.assign(Sequelize.prototype, require('./lob-plugin'));
};

exports.register = function (server, opts, next) {
    var sequelize, models;
    var schema = {
        database: joi.string().required(),
        user: joi.string().required(),
        password: joi.string().default(''),
        options: joi.object().keys({
            dialect: joi.string().default('postgres'),
            host: joi.string(),
            port: joi.number().integer(),
            sync: joi.any(),
            logging: joi.alternatives([joi.boolean(), joi.func()]).default(server.log.bind(server, ['db', 'debug']))
        }).default({ dialect: 'postgres' }),
        namespace: joi.string().optional(),
        appVar: joi.string().default('db'),
        auth: joi.any().default(false),
        transaction: {
            isolationLevel: 'READ_COMMITTED' // READ_COMMITTED, REPEATABLE_READ, OR SELIAZABLE
        },
        queryHandler: {
            limit: joi.number().integer().default(30)
        }
    };

    joi.validate(opts, schema, function (err, validated) {
        if (err) return next(err);

        opts = validated;
    });

    if (opts.namespace && process.namespaces && process.namespaces[opts.namespace]) {
        server.after(function (server, next) {
            Sequelize.cls = process.namespaces[opts.namespace];
            next();
        }, ['ent-hapi-cls']);
    }

    // turn on plugin support
    exports.enablePlugins();

    // turn on bulk upsert
    exports.enableBulkUpsert();

    // adds requiresTransaction() method to sequelize
    exports.enableRequiresTransaction();

    // turn on lobs
    exports.enableLobSupport();

    sequelize = new Sequelize(opts.database,
        opts.user,
        opts.password,
        opts.options);

    models = sequelize.models;

    var api = server.app[opts.appVar] = {
        models: models,
        model: function (modelName) {
            if (!models.hasOwnProperty(modelName)) throw new Error('No such model: ' + modelName);

            return models[modelName];
        },
        sequelize: sequelize,
        define: function (defineFn) {
            return defineFn(sequelize);
        },
        query: sequelize.query.bind(sequelize)
    };

    server.expose(api);
    server.after(function (server, done) {
        server.log(['ent-sequelize', 'log'], 'Associating models');
        exports.associate(sequelize);
        server.log(['ent-sequelize', 'log'], 'Syncing database schema...');
        return sequelize.sync().nodeify(done);
    });

    server.ext('onPreHandler', function (req, reply) {
        var seqConfig = req.route.settings.plugins.sequelize;
        if (seqConfig && seqConfig.transaction) {
            //joi.assert(seqConfig.transaction, {
            //    isolationLevel: [joi.boolean(), joi.string().valid(['READ_COMMITTED', 'REPEATABLE_READ', 'SERIALIZABLE'])]
            //});
            //
            //var transactionOpts = _.isBoolean(seqConfig.transaction) ? opts.transaction : seqConfig.transaction;

            req.server.log(['sequelize', 'info'], 'Starting transaction');

            sequelize.transaction()
                .then(function (t) {
                    req.plugins.sequelize = req.plugins.sequelize || {};
                    req.plugins.sequelize.transaction = t;
                    reply.continue();
                })
                .catch(reply);
        } else {
            reply.continue();
        }
    });

    server.ext('onPostHandler', function (req, reply) {
        var t = req.plugins.sequelize && req.plugins.sequelize.transaction;

        if (!t || t.finished) return reply.continue();

        if (req.response instanceof Error) {
            req.server.log(['sequelize', 'info'], 'Rolling back transaction');
            t.rollback().then(reply.continue.bind(reply));
        } else {
            req.server.log(['sequelize', 'info'], 'Committing transaction');
            t.commit().then(reply.continue.bind(reply));
        }
    });

    server.ext('onPostHandler', function (req, reply) {
        if (req.response instanceof sequelize.ValidationError) {
            var error = boom.badRequest(req.response);
            error.output.payload.validation = req.response.errors;
            return reply(error);
        }
        reply.continue();
    });

    server.route({
        path: '/api/db/_sync',
        method: 'post',
        config: {
            auth: opts.auth,
            handler: function (req, reply) {
                sequelize.sync({ force: true })
                    .then(function () {
                        return sequelize.model('User').create({
                            givenName: 'Administrator',
                            displayName: 'System Administrator',
                            username: 'admin',
                            password: '123'
                        });
                    })
                    .then(function(){
                        return {
                            sync: true,
                            adminUser: {
                                username: 'admin',
                                password: '123'
                            }
                        };
                    })
                    .nodeify(reply)
                    .catch(reply);
            }
        }
    });

    server.handler('db.query', queryHandler(sequelize, opts.queryHandler));
    server.handler('db.lookup', lookupHandler(sequelize));
    server.handler('db.remove', removeHandler(sequelize, opts.deleteHandler));
    server.handler('db.update', updateHandler(sequelize));
    server.handler('db.upsert' +
    '', function (route, options) {
        return updateHandler(sequelize, route, _.assign(options, { create: true }));
    });
    next();
};

exports.Sequelize = Sequelize;

exports.register.attributes = { pkg: require('../package.json') };