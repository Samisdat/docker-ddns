'use strict';

/*
cmd to get ip from local dns
dig @localhost dev.foo.org +short
*/

var expect = require('chai').expect;

var fs = require('fs');
var qfs = require('../../grunt/lib/qfs');

var rmdir = require('../../grunt/lib/rmdir');

var grunt = require('grunt');
grunt.log.write = function(){};
grunt.log.ok = function(){};
grunt.log.error = function(){};

var key = require('../../grunt/lib/key')(grunt);

var notFs = require('not-fs');

describe('key', function() {

    before(function() {
        notFs.swapIn();
    });

    after(function() {
        notFs.swapOut();
    });

    it('key.createKeyDir', function(done) {

        if (true === fs.existsSync('/ddns/key')){
            rmdir('/ddns/key');
        }

        var dirExists = fs.existsSync('/ddns/key');
        expect(dirExists).to.be.false;

        key.createKeyDir()
        .then(function(){

            dirExists = fs.existsSync('/ddns/key');
            expect(dirExists).to.be.true;

            done();

        });

    });

});


describe('testing in real file sys', function() {

    beforeEach(function() {
        if (true === fs.existsSync('/ddns/key')){
            rmdir('/ddns/key/');
        }

        fs.mkdirSync('/ddns/key');

    });

    it('key.wipeKeyDir', function(done) {

        key.wipeKeyDir()
        .then(function(){
            done();
        });

    });


    it('succeed in create a key', function(done) {

        var dirExists = fs.existsSync('/ddns/key');
        expect(dirExists).to.be.true;

        key.createKeyFiles()
        .then(function(){
            qfs.readdir('/ddns/key/')
            .then(function(files){
                expect(files.length).to.be.equal(2);
                done();
            });

        });

    });

    it('fail in create a key', function(done) {

        var dirExists = fs.existsSync('/ddns/key');
        expect(dirExists).to.be.true;
        rmdir('/ddns/key');

        key.createKeyFiles()
        .fail(function(){
            done();
        });

    });

    it('complete create', function(done) {

        var dirExists = fs.existsSync('/ddns/key');
        expect(dirExists).to.be.true;
        rmdir('/ddns/key');

        key.create()
        .then(function(){
            done();
        });

    });

});



describe('method server.readKey', function() {

    before(function() {
        notFs.swapIn();
    });

    after(function() {
        notFs.swapOut();
    });

    beforeEach(function() {
        if (true === fs.existsSync('/ddns/key/')){
            rmdir('/ddns/key/');
        }

        notFs.mkdirSync('/ddns/key/');

        var keyMock = [];
        keyMock.push('Private-key-format: v1.3');
        keyMock.push('Algorithm: 157 (HMAC_MD5)');
        keyMock.push('Key: aaaaaaaaaaaaaaaaaaaaaa==');
        keyMock.push('Bits: AAA=');
        keyMock.push('Created: 20160413014957');
        keyMock.push('Publish: 20160413014957');
        keyMock.push('Activate: 20160413014957');

        notFs.writeFileSync('/ddns/key/Kddns_update.+157+52345.private', keyMock.join('\n'), 'utf8');

        notFs.writeFileSync('/ddns/key/Kddns_update.+157+52345.key', 'DDNS_UPDATE. IN KEY 0 3 157 aaaaaaaaaaaaaaaaaaaaaa==', 'utf8');

    });

    it('fail while there should be two files', function(done) {

        fs.unlinkSync('/ddns/key/Kddns_update.+157+52345.key');

        key.readKey()
        .then(function(){
            done('should no succeed');
        })
        .fail(function(){
            done();
        });
    });

    it('fail while there should a private key', function(done) {

        notFs.writeFileSync('/ddns/key/foo', 'just a second file', 'utf8');
        fs.unlinkSync('/ddns/key/Kddns_update.+157+52345.private');

        key.readKey()
        .then(function(){
            done('should no succeed');
        })
        .fail(function(){
            done();
        });
    });

    it('fail while can find no key', function(done) {

        notFs.writeFileSync('/ddns/key/Kddns_update.+157+52345.private', 'foobar', 'utf8');

        key.readKey()
        .then(function(){
            done('should no succeed');
        })
        .fail(function(){
            done();
        });
    });

    it('fail while can find no key dir', function(done) {

        rmdir('/ddns/key/');

        key.readKey()
        .then(function(){
            done('should no succeed');
        })
        .fail(function(){
            done();
        });
    });

    it('find key', function(done) {
        key.readKey()
        .then(function(dnskey){
            expect(dnskey).to.be.equal('aaaaaaaaaaaaaaaaaaaaaa==');
            done();
        })
        .fail(function(){
            done('no key found');
        });
    });

});

