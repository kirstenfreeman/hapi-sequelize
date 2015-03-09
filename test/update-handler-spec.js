'use strict';

var chai = require('chai');
var should = chai.should();
var sinon = require('sinon');
chai.use(require('sinon-chai'));
var _ = require('lodash');
var factory = require('../lib/update-handler');
var joi = require('joi');
var Sequelize = require('sequelize');
var P = Sequelize.Promise;
var hapi = require('hapi');

var $;

describe('Generic Update Handler', function () {
    var server, updater, finder, thrower, sequelize;

    beforeEach(function () {
        //setup mocks
        
        
        updater = sinon.spy(function (payload, t) {
            return Sequelize.Promise.resolve(payload, t);
        });

        thrower = sinon.spy(function () {
            return Sequelize.Promise.resolve(null);
        });

        finder = sinon.spy(function (opts) {
            var instance = {
                username: opts.where && opts.where.username,
                change: 'robert',
                update: updater = sinon.spy(function (payload) {
                    var updatedInstance = {
                        username: instance.username,
                        change: payload.change
                    };
                    
                    return Sequelize.Promise.resolve(updatedInstance);
                })
            };
            
            return Sequelize.Promise.resolve(instance);
        });

        sequelize = {
            models: {
                User: {
                    attributes: {
                        firstName: {},
                        lastName: {}
                    },
                    associations: {
                        settings: {}
                    },
                    findOne: finder,
                    getAssociationByAlias: function (alias) {
                        return alias;
                    }
                },
                Bar: {
                    attributes: {
                        name: {}
                    },
                    findOne: thrower,
                    getAssociationByAlias: function (alias) {
                        return alias;
                    }
                }
            },
            model: function (model) {
                return sequelize.models[model];
            },
            requiresTransaction: function (func) {
                return func();
            }
        };
    });

    beforeEach(function (done) {
        server = new hapi.Server();
        server.connection();
        server.handler('db.update', factory(sequelize));
        server.register(require('inject-then'), done);
    });

    var addRoute = function (cfg) {
        server.route({path: '/users/{username}', method: 'put', config: _.assign(cfg, {id: 'user.update'})});
    };

    describe('registration', function () {
        it('should exist', function () {
            should.exist(factory);
        });

        it('should be a function', function () {
            factory.should.be.a('function');
        });

        it('should apply sequelize & return a function', function () {
            factory(sequelize).should.be.a('function');
        });

        it('should require a model', function () {
            addRoute.bind(null, {
                handler: {
                    'db.update': {}
                }
            }).should.throw('Error in route /users/{username}: model is required');

            addRoute.bind(null, {
                handler: {
                    'db.update': {
                        model: 'User'
                    }
                }
            }).should.not.throw();
        });

        it('should reject unknown model', function () {
            addRoute.bind(null, {
                handler: {
                    'db.update': {
                        model: 'Account'
                    }
                }
            }).should.throw('model must be one of User');
        });

        it('should support a where function', function () {
            addRoute.bind(null, {
                handler: {
                    'db.update': {
                        model: 'User',
                        where: function () {

                        }
                    }
                }
            }).should.not.throw();
        });

        it('should reject a non-function where', function () {
            addRoute.bind(null, {
                handler: {
                    'db.update': {
                        model: 'User',
                        where: {foo: 'bar'}
                    }
                }
            }).should.throw('where must be a Function');
        });

        it('should support a preLookup extension point that is a function', function () {
            addRoute.bind(null, {
                handler: {
                    'db.update': {
                        model: 'User',
                        preUpdate: function () {
                        }
                    }
                }
            }).should.not.throw();
        });

        it('should reject a preLookup extension point that is not a function', function () {
            addRoute.bind(null, {
                handler: {
                    'db.update': {
                        model: 'User',
                        preUpdate: 'bar'
                    }
                }
            }).should.throw('preUpdate must be a Function');
        });

        it('should support a postLookup extension point that is a function', function () {
            addRoute.bind(null, {
                handler: {
                    'db.update': {
                        model: 'User',
                        postUpdate: function () {
                        }
                    }
                }
            }).should.not.throw();
        });

        it('should support sequelize options', function () {
            addRoute.bind(null, {
                handler: {
                    'db.update': {
                        model: 'User',
                        options: { validate: false }
                    }
                }
            }).should.not.throw();
        });

        it('should reject a postLookup extension point that is not a function', function () {
            addRoute.bind(null, {
                handler: {
                    'db.update': {
                        model: 'User',
                        postUpdate: 'bar'
                    }
                }
            }).should.throw('postUpdate must be a Function');
        });

        it('should return a handler function when invoked', function () {
            factory(sequelize, {model: 'User'}).should.be.a('function');
        });

    });

    describe('handler', function () {
        it('should update the model using path params as a natural id', function () {
            server.route({
                method: 'put',
                path: '/users/{username}',
                handler: {
                    'db.update': {
                        model: 'User'
                    }
                }
            });

            return server.injectThen({
                method: 'put',
                url: '/users/robert',
                payload: {
                    change: 'changeit'
                }
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.should.have.been.calledWith({ transaction: undefined, where: {username: 'robert'} });
                updater.should.have.been.calledWith({change: 'changeit'});
            });
        });
        
        it('should ', function () {
            server.route({
                method: 'put',
                path: '/users',
                handler: {
                    'db.update': {
                        model: 'User'
                    }
                }
            });

            return server.injectThen({
                method: 'put',
                url: '/users',
                payload: {
                    change: 'changeit'
                }
            }).then(function (res) {
                res.should.have.property('statusCode', 400);
            });
        });

        it('should use a configured where function', function () {
            server.route({
                method: 'put',
                path: '/users',
                config: {
                    handler: {
                        'db.update': {
                            model: 'User',
                            where: function (req) {
                                return {username: req.query.username};
                            }
                        }
                    },
                    validate: {
                        query: {
                            username: joi.string()
                        }
                    }
                }
            });

            return server.injectThen({
                method: 'put',
                url: '/users?username=robert',
                payload: {
                    change: 'changeit'
                }
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.should.have.been.calledWith({ transaction: undefined, where: {username: 'robert'} });
                updater.should.have.been.calledWith({ change: 'changeit' });
            });
        });

        it('should return the entity if found and updated', function () {
            server.route({
                path: '/users/{username}',
                method: 'put',
                handler: {
                    'db.update': {
                        model: 'User'
                    }
                }
            });

            return server.injectThen({
                method: 'put',
                url: '/users/robert',
                payload: { change: 'changeit' }
            }).then(function (res) {
                var body = JSON.parse(res.payload);
                body.should.have.property('username', 'robert');
                body.should.have.property('change', 'changeit');
            });
        });

        it('should return a 404 if not found', function () {
            server.route({
                path: '/bars/{barId}',
                method: 'put',
                handler: {
                    'db.update': {
                        model: 'Bar'
                    }
                }
            });

            return server.injectThen({
                method: 'put',
                url: '/bars/snookerz'
            }).then(function (res) {
                res.should.have.property('statusCode', 404);
            });
        });

        it('should not call postLookup method if not found', function () {
            var postUpdate = sinon.spy(function () {
                return null;
            });

            server.route({
                path: '/bars/{barId}',
                method: 'put',
                handler: {
                    'db.update': {
                        model: 'Bar',
                        postUpdate: postUpdate
                    }
                }
            });

            return server.injectThen({
                method: 'put',
                url: '/bars/snookerz'
            })
                .then(function (res) {
                    res.should.have.property('statusCode', 404);
                    postUpdate.callCount.should.equal(0);
                });
        });

        it('should apply extra sequelize options to the update command', function () {
            server.route({
                path: '/users/{username}',
                method: 'put',
                handler: {
                    'db.update': {
                        model: 'User',
                        options: { silent: true }
                    }
                }
            });

            return server.injectThen({
                method: 'put',
                url: '/users/robert',
                payload: { change: 'changeit' }
            }).then(function (res) {
                res.statusCode.should.equal(200);
                updater.should.have.been.calledWith({ change: 'changeit' }, {
                    transaction: undefined,
                    silent: true
                });
            });
        });
    });

});