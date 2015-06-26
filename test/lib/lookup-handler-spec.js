'use strict';

var chai = require('chai');
var should = chai.should();
var sinon = require('sinon');
chai.use(require('sinon-chai'));
var _ = require('lodash');
var factory = require('../../lib/lookup-handler');
var joi = require('joi');
var Sequelize = require('sequelize');
var P = Sequelize.Promise;
var hapi = require('hapi');

var $;

describe('Generic Lookup Handler', function () {
    var server, finder, thrower, sequelize;

    beforeEach(function () {
        //setup mocks
        finder = sinon.spy(function (opts){
            return Sequelize.Promise.resolve({ username: opts.where && opts.where.username });
        });

        thrower = sinon.spy(function () {
            return Sequelize.Promise.resolve(null);
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
                    find: finder
                },
                Bar: {
                    attributes: {
                        name: {}
                    },
                    find: thrower,
                    associations: {}
                }
            }
        };
    });

    beforeEach(function (done) {
        server = new hapi.Server();
        server.connection();
        server.handler('db.lookup', factory(sequelize));
        server.register(require('inject-then'), done);
    });

    var addRoute = function (cfg) {
        server.route({ path: '/users/{username}', method: 'get', config: _.assign(cfg, {id: 'user.lookup'})});
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
                    'db.lookup': {}
                }
            }).should.throw('Error in route /users/{username}: model is required');

            addRoute.bind(null, {
                handler: {
                    'db.lookup': {
                        model: 'User'
                    }
                }
            }).should.not.throw();
        });

        it('should reject unknown model', function () {
            addRoute.bind(null, {
                handler: {
                    'db.lookup': {
                        model: 'Account'
                    }
                }
            }).should.throw('model must be one of User');
        });

        it('should support a where function', function () {
            addRoute.bind(null, {
                handler: {
                    'db.lookup': {
                        model: 'User',
                        where: function(){

                        }
                    }
                }
            }).should.not.throw();
        });

        it('should reject a non-function where', function () {
            addRoute.bind(null, {
                handler: {
                    'db.lookup': {
                        model: 'User',
                        where: {foo: 'bar'}
                    }
                }
            }).should.throw('where must be a Function');
        });

        it('should support a preLookup extension point that is a function', function () {
            addRoute.bind(null, {
                handler: {
                    'db.lookup': {
                        model: 'User',
                        preLookup: function() {
                        }
                    }
                }
            }).should.not.throw();
        });

        it('should reject a preLookup extension point that is not a function', function () {
            addRoute.bind(null, {
                handler: {
                    'db.lookup': {
                        model: 'User',
                        preLookup: 'bar'
                    }
                }
            }).should.throw('preLookup must be a Function');
        });

        it('should support a postLookup extension point that is a function', function () {
            addRoute.bind(null, {
                handler: {
                    'db.lookup': {
                        model: 'User',
                        postLookup: function() {
                        }
                    }
                }
            }).should.not.throw();
        });

        it('should reject a postLookup extension point that is not a function', function () {
            addRoute.bind(null, {
                handler: {
                    'db.lookup': {
                        model: 'User',
                        postLookup: 'bar'
                    }
                }
            }).should.throw('postLookup must be a Function');
        });

        it('should return a handler function when invoked', function () {
            factory(sequelize, {model: 'User'}).should.be.a('function');
        });

        it('should set route validation', function () {
            addRoute({
                handler: {
                    'db.lookup': {
                        model: 'User'
                    }
                }
            });

            var route = server.lookup('user.lookup');
            route.settings.validate.query.describe().children.should.have.property('expand');
        });


        describe('handler', function () {
            it('should look up the model using path params as a natural id', function () {
                server.route({
                    method: 'get',
                    path: '/users/{username}',
                    handler: {
                        'db.lookup': {
                            model: 'User'
                        }
                    }
                });

                return server.injectThen({
                    method: 'get',
                    url: '/users/bleupen'
                }).then(function (res) {
                    res.statusCode.should.equal(200);
                    finder.should.have.been.calledWith({ where: { username: 'bleupen' }});
                });
            });

            it('should use a configured where function', function () {
                server.route({
                    method: 'get',
                    path: '/users',
                    config: {
                        handler: {
                            'db.lookup': {
                                model: 'User',
                                where: function (req) {
                                    return { username: req.query.username };
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
                    method: 'get',
                    url: '/users?username=hank'
                }).then(function (res) {
                    res.statusCode.should.equal(200);
                    finder.should.have.been.calledWith({ where: { username: 'hank'}});
                });
            });

            it('should expand an entity', function () {
                server.route({
                    path: '/users/{username}',
                    method: 'get',
                    handler: {
                        'db.lookup': {
                            model: 'User'
                        }
                    }
                });

                return server.injectThen({
                    method: 'get',
                    url: '/users/hank?expand=settings'
                }).then(function (res) {
                    res.statusCode.should.equal(200);
                    finder.should.have.been.calledWith({
                        include: [ sequelize.models.User.associations.settings ],
                        where: { username: 'hank' }
                    });
                });
            });

            it('should reject an invalid expansion', function () {
                server.route({
                    path: '/users/{username}',
                    method: 'get',
                    handler: {
                        'db.lookup': {
                            model: 'User'
                        }
                    }
                });

                return server.injectThen({
                    method: 'get',
                    url: '/users/hank?expand=boss'
                }).then(function (res) {
                    var body = JSON.parse(res.payload);
                    res.statusCode.should.equal(400);
                    body.message.should.equal('single value of expand fails because value must be one of settings');
                });
            });

            it('should reject an expansion on an entity with no associations', function () {
                server.route({
                    path: '/bars/{barId}',
                    method: 'get',
                    handler: {
                        'db.lookup': {
                            model: 'Bar'
                        }
                    }
                });

                return server.injectThen({
                    method: 'get',
                    url: '/bars/snookers?expand=patrons'
                }).then(function (res) {
                    var body = JSON.parse(res.payload);
                    res.statusCode.should.equal(400);
                    body.message.should.equal('expand is not allowed');
                });
            });

            it('should return the entity if found', function () {
                server.route({
                    path: '/users/{username}',
                    method: 'get',
                    handler: {
                        'db.lookup': {
                            model: 'User'
                        }
                    }
                });

                return server.injectThen({
                    mehod: 'get',
                    url: '/users/hank'
                }).then(function (res) {
                    var body = JSON.parse(res.payload);
                    body.should.have.property('username', 'hank');
                });
            });

            it('should return a 404 if not found', function () {
                server.route({
                    path: '/bars/{barId}',
                    method: 'get',
                    handler: {
                        'db.lookup': {
                            model: 'Bar'
                        }
                    }
                });

                return server.injectThen({
                    mehod: 'get',
                    url: '/bars/snookerz'
                }).then(function (res) {
                    res.should.have.property('statusCode', 404);
                });
            });

            it('should support a single required expansions', function () {
                server.route({
                    path: '/users/{username}',
                    method: 'get',
                    handler: {
                        'db.lookup': {
                            model: 'User',
                            expand: {
                                required: 'settings'
                            }
                        }
                    }
                });

                return server.injectThen('/users/hank')
                    .then(function (res) {
                        res.should.have.property('statusCode', 200);
                        finder.should.have.been.calledWith({ where: { username: 'hank' }, include: [sequelize.models.User.associations.settings] });
                    });
            });

            it('should support an array of required expansions', function () {
                server.route({
                    path: '/users/{username}',
                    method: 'get',
                    handler: {
                        'db.lookup': {
                            model: 'User',
                            expand: {
                                required: ['settings']
                            }
                        }
                    }
                });

                return server.injectThen('/users/hank')
                    .then(function (res) {
                        res.should.have.property('statusCode', 200);
                        finder.should.have.been.calledWith({ where: { username: 'hank' }, include: [sequelize.models.User.associations.settings] });
                    });
            });

            it('should not call postLookup method if not found', function () {
                var postLookup = sinon.spy(function() {
                    return null;
                });

                server.route({
                    path: '/bars/{barId}',
                    method: 'get',
                    handler: {
                        'db.lookup': {
                            model: 'Bar',
                            postLookup: postLookup
                        }
                    }
                });

                return server.injectThen('/bars/snookerz')
                    .then(function (res) {
                        res.should.have.property('statusCode', 404);
                        postLookup.callCount.should.equal(0);
                    });
            });
        });
    });

});