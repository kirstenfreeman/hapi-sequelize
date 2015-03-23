'use strict';

var chai = require('chai');
var should = chai.should();
var queryHandlerFactory = require('../lib/query-handler');
var Sequelize = require('sequelize');
var hapi = require('hapi');
var joi = require('joi');
var sinon = require('sinon');
var _ = require('lodash');

chai.use(require('sinon-chai'));

describe('QueryHandler', function () {
    var server, finder, sequelize;

    beforeEach(function () {
        finder = sinon.spy(function (opts, queryOpts) {
            var rows = [
                { firstName: 'Brad', lastName: 'Leupen' },
                { firstName: 'Hank', lastName: 'Leupen' }
            ];

            return Sequelize.Promise.resolve({ rows: rows, count: 2 });
        });

        sequelize = {
            models: {
                User: {
                    attributes: {
                        firstName: {},
                        lastName: {}
                    },
                    findAndCountAll: finder,
                    associations: {
                        department: 'department'
                    },
                    getAssociationByAlias: function (alias) {
                        return alias;
                    }
                },
                Set: {
                    attributes: {
                        name: {}
                    },
                    findAndCountAll: finder,
                    getAssociationByAlias: function (alias) {
                        return alias;
                    }
                }
            }
        };
    });

    beforeEach(function (done) {
        server = new hapi.Server();
        server.connection();
        server.handler('db.query', queryHandlerFactory(sequelize, { limit: 30 }));
        server.register(require('inject-then'), done);
    });

    var addRoute = function (config) {
        server.route({ path: '/users', method: 'get', config: _.assign(config, { id: 'user.search' }) });
    };

    describe('registration function', function () {

        it('should exist', function () {
            should.exist(queryHandlerFactory);
        });

        it('should be a function', function () {
            queryHandlerFactory.should.be.a('function');
        });

        it('should partially apply sequelize', function () {
            queryHandlerFactory(sequelize).should.be.a('function');
        });

        it('should require a model', function () {
            addRoute.bind(null, { handler: { 'db.query': {} } }).should.throw('model is required');
            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User'
                    }
                }
            }).should.not.throw();
        });

        it('should reject an unregistered model', function () {
            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'Datasource'
                    }
                }
            }).should.throw('model must be one of User');
        });

        it('should support a default sort array', function () {
            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User',
                        sort: ['name']
                    }
                }
            }).should.not.throw();
        });

        it('should support a default sort field', function () {
            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User',
                        sort: 'name'
                    }
                }
            }).should.not.throw();
        });

        it('should support a query fields array', function () {
            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User',
                        query: ['name']
                    }
                }
            }).should.not.throw();
        });

        it('should support a single query field', function () {
            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User',
                        query: 'name'
                    }
                }
            }).should.not.throw();
        });

        it('should support a where function', function () {
            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User',
                        where: function (req) {
                        }
                    }
                }
            }).should.not.throw();

            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User',
                        where: 'name'
                    }
                }
            }).should.throw('where must be a Function');
        });

        it('should support query options', function () {
            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User',
                        queryOptions: {
                            subQuery: false
                        }
                    }
                }
            }).should.not.throw();
        });

        describe('expand', function () {
            it('should support an expand descriptor', function () {
                addRoute.bind(null, {
                    handler: {
                        'db.query': {
                            model: 'User',
                            expand: {}
                        }
                    }
                }).should.not.throw();
            });

            it('should support required expansions function', function () {
                addRoute.bind(null, {
                    handler: {
                        'db.query': {
                            model: 'User',
                            expand: {
                                required: function () {
                                }
                            }
                        }
                    }
                }).should.not.throw();
            });

            it('should support a valid expansion array', function () {
                addRoute.bind(null, {
                    handler: {
                        'db.query': {
                            model: 'User',
                            expand: {
                                valid: ['settings']
                            }
                        }
                    }
                }).should.not.throw();
            });

            it('should support a valid expansion string', function () {
                addRoute.bind(null, {
                    handler: {
                        'db.query': {
                            model: 'User',
                            expand: {
                                valid: 'settings'
                            }
                        }
                    }
                }).should.not.throw();
            });

            it('should support an invalid expansion array', function () {
                addRoute.bind(null, {
                    handler: {
                        'db.query': {
                            model: 'User',
                            expand: {
                                invalid: ['settings']
                            }
                        }
                    }
                }).should.not.throw();
            });

            it('should support an invalid expansion string', function () {
                addRoute.bind(null, {
                    handler: {
                        'db.query': {
                            model: 'User',
                            expand: {
                                invalid: 'settings'
                            }
                        }
                    }
                }).should.not.throw();
            });
        });

        it('should support a postQuery callback function', function () {
            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User',
                        postQuery: 'doo'
                    }
                }
            }).should.throw('postQuery must be a Function');

            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User',
                        postQuery: function () {
                        }
                    }
                }
            }).should.not.throw();
        });

        it('should support a preQuery callback function', function () {
            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User',
                        preQuery: 'doo'
                    }
                }
            }).should.throw('preQuery must be a Function');

            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User',
                        preQuery: function () {
                        }
                    }
                }
            }).should.not.throw();
        });

        it('should support a limit option', function () {
            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User',
                        limit: 'ten'
                    }
                }
            }).should.throw('limit must be a number');

            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User',
                        limit: 10
                    }
                }
            }).should.not.throw();
        });

        it('should support extra sequelize options', function () {
            addRoute.bind(null, {
                handler: {
                    'db.query': {
                        model: 'User',
                        options: {
                            attributes: ['firstName', 'lastName']
                        }
                    }
                }
            }).should.not.throw();
        });

        it('should return a handler function', function () {
            queryHandlerFactory(sequelize, { settings: {} }, { model: 'User' }).should.be.a('function');
        });

        it('should set the routes query validation', function () {
            addRoute({
                handler: {
                    'db.query': {
                        model: 'User',
                        query: ['username', 'name']
                    }
                }
            });

            var route = server.lookup('user.search');
            should.exist(route.settings.validate.query);
        });

        it('should combine an existing schema', function () {
            addRoute({
                handler: {
                    'db.query': {
                        model: 'User',
                        query: ['username', 'name']
                    }
                },
                validate: {
                    query: {
                        foo: joi.string().required().valid('bar')
                    }
                }
            });

            var route = server.lookup('user.search');
            route.settings.validate.query.describe().children.should.have.property('foo');
        });
    });

    describe('route handler', function () {
        it('should query the model with no options', function () {
            addRoute({
                handler: {
                    'db.query': { model: 'User' }
                }
            });

            return server.injectThen({
                method: 'get',
                url: '/users'
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.should.have.been.calledWith({ limit: 30, offset: 0 });
            });
        });

        it('should use the handler where clause', function () {
            server.route({
                path: '/{department}/users',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'User',
                        where: function (req) {
                            return { department: req.params.department };
                        }
                    }
                }
            });

            return server.injectThen({
                method: 'get',
                url: '/engineering/users'
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.should.have.been.calledWith({
                    where: { department: 'engineering' },
                    limit: 30,
                    offset: 0
                });
            });
        });

        it('should query the query fields with no other where clause', function () {
            server.route({
                path: '/users',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'User',
                        query: 'username'
                    }
                }
            });

            return server.injectThen({
                method: 'get',
                url: '/users?q=smith'
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.args[0][0].where.args[0].should.deep.equal({ username: { ilike: '%smith%' } });
            });
        });

        it('should query the query fields with existing where clause', function () {
            server.route({
                path: '/users',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'User',
                        query: 'username',
                        where: function () {
                            return { department: 'engineering' };
                        }
                    }
                }
            });

            return server.injectThen({
                method: 'get',
                url: '/users?q=smith'
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.args[0][0].where.args[0].should.deep.equal({ department: 'engineering' });
                finder.args[0][0].where.args[1].args[0].should.deep.equal({ username: { ilike: '%smith%' } });
            });
        });

        it('should include an association', function () {
            server.route({
                path: '/users',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'User'
                    }
                }
            });

            return server.injectThen({
                method: 'get',
                url: '/users?expand=department'
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.should.have.been.calledWith({ offset: 0, limit: 30, include: ['department'] });
            });
        });

        it('should order ascending', function () {
            server.route({
                path: '/users',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'User'
                    }
                }
            });

            return server.injectThen({
                method: 'get',
                url: '/users?sort=firstName'
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.should.have.been.calledWith({ offset: 0, limit: 30, order: [[['firstName', 'ASC']]] });
            });
        });

        it('should order descending', function () {
            server.route({
                path: '/users',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'User'
                    }
                }
            });

            return server.injectThen({
                method: 'get',
                url: '/users?sort=-firstName'
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.should.have.been.calledWith({ offset: 0, limit: 30, order: [[['firstName', 'DESC']]] });
            });
        });

        it('should order ascending and descending', function () {
            server.route({
                path: '/users',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'User'
                    }
                }
            });

            return server.injectThen({
                method: 'get',
                url: '/users?sort=-lastName&sort=firstName'
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.should.have.been.calledWith({
                    offset: 0,
                    limit: 30,
                    order: [[['lastName', 'DESC']], [['firstName', 'ASC']]]
                });
            });
        });

        it('should query an entity with no associations', function () {
            server.route({
                path: '/sets',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'Set'
                    }
                }
            });

            return server.injectThen({
                method: 'get',
                url: '/sets'
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.should.have.been.calledWith({ offset: 0, limit: 30 });
            });
        });

        it('should not include limit if set to -1', function () {
            server.route({
                path: '/sets',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'Set'
                    }
                }
            });

            return server.injectThen({
                method: 'get',
                url: '/sets?start=10&limit=-1'
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.should.have.been.calledWith({ offset: 10 });
            });
        });

        it('should support a single required expansion', function () {
            server.route({
                path: '/users',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'User',
                        expand: {
                            required: 'department'
                        }
                    }
                }
            });

            return server.injectThen('/users')
                .then(function (res) {
                    res.statusCode.should.equal(200);
                    finder.should.have.been.calledWith({ limit: 30, offset: 0, include: ['department'] });
                });
        });

        it('should support a required expansion array', function () {
            server.route({
                path: '/users',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'User',
                        expand: {
                            required: ['department']
                        }
                    }
                }
            });

            return server.injectThen('/users')
                .then(function (res) {
                    res.statusCode.should.equal(200);
                    finder.should.have.been.calledWith({ limit: 30, offset: 0, include: ['department'] });
                });
        });

        it('should use request params as a default where clause', function () {
            server.route({
                path: '/departments/{departmentId}/people',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'User'
                    }
                }
            });

            return server.injectThen({
                method: 'get',
                url: '/departments/engineering/people'
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.should.have.been.calledWith({ limit: 30, offset: 0, where: { departmentId: 'engineering' } });
            });
        });

        it('should pass through sequelize options', function () {
            server.route({
                path: '/users',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'User',
                        options: {
                            attributes: ['firstName', 'lastName']
                        }
                    }
                }
            });

            return server.injectThen({
                method: 'get',
                url: '/users'
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.should.have.been.calledWith({
                    limit: 30,
                    offset: 0,
                    attributes: ['firstName', 'lastName']
                });
            });
        });

        it('should pass through sequelize query options', function () {
            server.route({
                path: '/users',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'User',
                        queryOptions: {
                            subQuery: false
                        }
                    }
                }
            });

            return server.injectThen({
                method: 'get',
                url: '/users'
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.should.have.been.calledWith({
                    limit: 30,
                    offset: 0,
                }, { subQuery: false });
            });
        });

        it('should use the routes default sort options', function () {
            server.route({
                path: '/users',
                method: 'get',
                handler: {
                    'db.query': {
                        model: 'User',
                        sort: 'lastName',
                        options: {
                            attributes: ['firstName', 'lastName']
                        }
                    }
                }
            });

            return server.injectThen({
                method: 'get',
                url: '/users'
            }).then(function (res) {
                res.statusCode.should.equal(200);
                finder.should.have.been.calledWith({
                    limit: 30,
                    offset: 0,
                    order: [[['lastName', 'ASC']]],
                    attributes: ['firstName', 'lastName']
                });
            });
        });
    });
});