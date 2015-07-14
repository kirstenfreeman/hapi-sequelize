'use strict';

var history = require('../../lib/history-plugin');
var chai = require('chai');
var should = chai.should();
var _ = require('lodash');
var db = require('../db');
var sequelize = db.sequelize;
var DataTypes = sequelize.Sequelize;

chai.use(require('chai-as-promised'));

describe.only('history-plugin', function () {
    var Order, OrderHistory;

    beforeEach(function () {
        Order = sequelize
            .define('Order', {
                product: DataTypes.STRING,
                amount: DataTypes.DOUBLE,
                customer: DataTypes.STRING,
                untracked: DataTypes.STRING
            }, { tableName: 'order' })
            .plugin(history({
                track: ['product', 'amount', 'customer'],
                user: _.constant('Hank')
            }));

        OrderHistory = sequelize.models.OrderHistory;

        return sequelize.sync({ force: true });
    });

    it('should exist', function () {
        should.exist(history);
    });

    it('should be a function', function () {
        history.should.be.a('function');
    });

    it('should return a model plugin function', function () {
        history().should.be.a('function').that.has.length(1);
    });

    it('should define a history model', function () {
        sequelize.models.should.have.property('OrderHistory');
    });

    it('should have an _id attribute', function () {
        OrderHistory.attributes.should.have.property('_id');
    });

    it('should have a _user attribute', function () {
        OrderHistory.attributes.should.have.property('_user');
    });

    it('should have an _op attribute', function () {
        OrderHistory.attributes.should.have.property('_op');
    });

    it('should have a _date attribute', function () {
        OrderHistory.attributes.should.have.property('_date');
    });

    it('should have a _changes attribute', function () {
        OrderHistory.attributes.should.have.property('_changes');
    });

    it('should ignore untracked fields', function () {
        OrderHistory.attributes.should.not.have.property('untracked');
    });

    it('should index the _id property', function () {
        OrderHistory.options.indexes.should.have.length(1);
        OrderHistory.options.indexes[0].should.have.property('fields').that.has.members(['_id']);
    });

    it('should include an association to the tracked model', function () {
        OrderHistory.associations.should.have.property('source');
    });

    describe('when the tracked model has been inserted', function () {
        var order;

        beforeEach(function () {
            return Order.create({ product: 'SEMtek', customer: 'Bert Leupen', amount: 200.00 })
                .then(function (value) {
                    order = value;
                });
        });

        it('should add a single history record', function () {
            return OrderHistory.findAll()
                .then(function(history) {
                    history.should.have.length(1);
                    history[0].should.have.property('_id', order.id);
                    history[0].should.have.property('_user', 'Hank');
                    history[0].should.have.property('_date');
                    history[0].should.have.property('_op', 'insert');
                    history[0].should.have.property('product', order.product);
                    history[0].should.have.property('customer', order.customer);
                    history[0].should.have.property('amount', order.amount);
                })
        });

        it('should save a reference to the tracked items id', function () {
            return OrderHistory.findAll({ where: { _id: order.id } }).should.eventually.have.length(1);
        });

        it('should save a reference to the user who made the change', function () {
            return OrderHistory.findAll({ where: { _user: 'Hank' } }).should.eventually.have.length(1);
        });

        describe('when a tracked item has been updated', function () {
            beforeEach(function () {
                return order.update({ amount: 300.00 });
            });

            it('should update the history', function () {
                return OrderHistory.findAll({ order: [['_date', 'DESC']] })
                    .then(function (history) {
                        history.should.have.length(2);
                    });
            });
        });

        describe('when the tracked item has been deleted', function () {
            beforeEach(function () {
                return order.destroy();
            });

            it('should remove the history records', function () {
                return OrderHistory.count().should.eventually.equal(0);
            });
        });
    });
});