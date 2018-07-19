'use strict';

const common = require('./common');
const { UpsertModel, MultipartUpsertModel } = common.models;

describe.only('native upsert plugin', function () {
    describe('for a single part unique constraint', function () {
        describe('when no record exists', function () {
            it('should insert', async function () {
                let instance = await UpsertModel.pgUpsert({ naturalId: 'foo', name: 'Foo' });
                instance.get().should.deep.equal({ id: 1, naturalId: 'foo', name: 'Foo' });
            });
        });

        describe('when a record exists', function () {
            beforeEach(() => UpsertModel.create({ id: 1, naturalId: 'foo', name: 'Foo' }));

            it('should update', async function () {
                const instance = await UpsertModel.pgUpsert({ naturalId: 'foo', name: 'Bar' });
                instance.get().should.deep.equal({ id: 1, naturalId: 'foo', name: 'Bar' });
            });
        });
    });

    describe('for multi part unique constraint', function () {
        describe('when no record exists', function () {
            it('should insert', async function () {
                let instance = await MultipartUpsertModel.pgUpsert({
                    naturalId1: 'foo',
                    naturalId2: 'bar',
                    name: 'FooBar'
                });
                instance.get().should.deep.equal({ id: 1, naturalId1: 'foo', naturalId2: 'bar', name: 'FooBar' });
            });
        });

        describe('when a record exists', function () {
            beforeEach(() => MultipartUpsertModel.create({ naturalId1: 'foo', naturalId2: 'bar', name: 'FooBar' }));

            it('should update', async function () {
                const instance = await MultipartUpsertModel.pgUpsert({ naturalId1: 'foo', naturalId2: 'bar', name: 'BarBaz' });
                instance.get().should.deep.equal({ id: 1, naturalId1: 'foo', naturalId2: 'bar', name: 'BarBaz' });
            });
        });
    });
});