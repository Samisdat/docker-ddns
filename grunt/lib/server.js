'use strict';

var Q = require('q');
var fs = require('fs');
var qexec = require('./qexec');
var qfs = require('./qfs');
var config = require('./config');

module.exports = function (grunt) {

    var nameServer = 'ns.example.com';
    var ddnsDomain = 'dev.example.com';

    var createKey = function(){

        var deferred = Q.defer();

        qexec(grunt.log, 'mkdir -p /ddns/key', 'create dir for key', 750, true)
        .then(function () {
            config.setKeyName(undefined);

            return qexec(grunt.log, 'rm -f /ddns/key/Kddns_update*', 'delete key if already exists')
        })
        .then(function () {
            return qexec(grunt.log, 'dnssec-keygen -K /ddns/key/ -a HMAC-MD5 -b 128 -r /dev/urandom -n USER DDNS_UPDATE', 'create key')
        })
        .then(function (response) {
            config.setKeyName(response.stdout.trim());
            deferred.resolve();
        })
        .fail(function(){
            deferred.reject('key could not be created');    
        });

        return deferred.promise;
    };

    var backupConfLocal = function(){

        var deferred = Q.defer();

        qfs.fileExists('/etc/bind/named.conf.local')
        .then(function(){

            grunt.log.write('Backup "/etc/bind/named.conf.local"... ');

            qfs.rename('/etc/bind/named.conf.local', '/etc/bind/named.conf.local.bac')
            .then(function(){
                grunt.log.ok();
                deferred.resolve();
            })
            .fail(function(){
                deferred.reject(response);
                grunt.log.error();                
            });         

        })
        .fail(function(){

            deferred.reject('/etc/bind/named.conf.local does not exists');
        })

        return deferred.promise;
    };

    var removeConfLocal = function(){
        return qfs.unlink('/etc/bind/named.conf.local');
    };

    var createConfLocal = function(){
        return  qfs.writeFile('/etc/bind/named.conf.local', '// generated by samisdat/ddns');
    };    

    var readKey = function(){
        var deferred = Q.defer();
        
        qfs.readdir('/ddns/key')
        .then(function(files){

            if(2 !== files.length){
                deferred.reject();    
            }

            var privateKey = false;
            for(var i = 0, x = files.length; i < x; i +=1){
                if(true === /^Kddns_update\.(.*?)\.private$/.test(files[i])){
                    privateKey = files[i];
                }
            }

            if(false === privateKey){
                deferred.reject();
            }

            qfs.readFile('/ddns/key/' + privateKey)
            .then(function(data){

                var key = data.match(/Key\: (.*?)[\n\r]/m);

                if(null === key){
                    deferred.reject();       
                }

                deferred.resolve(key[1]);

            })
            .fail(function(error){
                deferred.reject(error);
            });
            

        })
        .fail(function(error){
            deferred.reject(error);
        });

        return deferred.promise;
    };

    var addKeyToConfLocal = function(){

        var deferred = Q.defer();

        readKey()
        .then(function (key) {


            if(undefined === key){
                deferred.reject('could not read key')
            }

            var keyTpl = fs.readFileSync(config.getTplPath() + 'key',{encoding:'utf8'});

            var keyPart = grunt.template.process(keyTpl, {data: {dnssec_key:key}});

            qfs.appendFile('/etc/bind/named.conf.local', keyPart)
            .then(function(){
                deferred.resolve();
            });            

        })
        .fail(function(){

            deferred.reject('could not read key');

        });

        return deferred.promise;
    };

    var createZone = function(nameServer, ddnsDomain){

        var data = {
            nameServer: nameServer,
            ddnsDomain: ddnsDomain
        };

        var dbTpl = fs.readFileSync(config.getTplPath() + 'db',{encoding:'utf8'});
        var db = grunt.template.process(dbTpl, {data: data});

        var zoneTpl = fs.readFileSync(config.getTplPath() + 'zone',{encoding:'utf8'});
        var zone = grunt.template.process(zoneTpl, {data: data});

        return Q.all([
            qfs.writeFile('/etc/bind/db.' + ddnsDomain, db),
            qfs.appendFile('/etc/bind/named.conf.local', zone)
        ]);        
    };

    var createZones = function(){

        var nameServer = config.getNameServer();
        var zones = config.getZones();

        if(undefined === nameServer || 0 === zones.length){
            var deferred = Q.defer();

            deferred.reject();

            return deferred.promise;
        }

        var promises = [];

        for(var i = 0, x = zones.length; i < x; i += 1){
            promises.push(createZone(nameServer, zones[i]));
        }

        console.log(promises)
        return Q.all(promises);

    };

    var enableLogging = function(){
        
        var deferred = Q.defer();
        
        var logConfig = fs.readFileSync(config.getTplPath() + 'logging', {encoding:'utf8'});
        console.log(logConfig)
        fs.appendFileSync('/etc/bind/named.conf.local', logConfig);

        if(false === fs.existsSync('/var/log/named/')){
            fs.mkdirSync('/var/log/named/');    
        }
        

        qexec(grunt.log, 'chown bind:bind /var/log/named/', 'set correct rights for log file', 750, true)
        .then(function (response) {

            deferred.resolve();

        }).fail(function(){

            deferred.reject();

        });

        return deferred.promise;
    };

    /* this is needed to make sure that *.jnl can be created */
    var chownBindDir = function(){
            
        return qexec(grunt.log, 'chown bind:bind /etc/bind', 'let bind own it\'s dir', 750, true);
    };

    var restartBind = function(){
            
        return qexec(grunt.log, 'service bind9 restart', 'bind restart', 0, true);
    };

    var firstSetup = function(nameServer, domains){
        console.log('firstSetup', nameServer, domains);
        var deferred = Q.defer();
        console.log('createKey');

        createKey()
        .then(function(){
            console.log('backupConfLocal');            
            return backupConfLocal();
        })
        .then(function(){
            console.log('removeConfLocal');                        
            return removeConfLocal();
        })
        .fail(function(){
            var deferred = Q.defer();
            deferred.resolve();
            return deferred.promise;
        })

        .then(function(){
            console.log('createConfLocal');                        
            return createConfLocal();
        })

        .then(function(){
            console.log('addKeyToConfLocal');                        
            return addKeyToConfLocal()
        })
        .then(function(){
            console.log('createZones');            
            return createZones(nameServer, domains)
        })
        .then(function(){
            console.log('enableLogging');                        
            return enableLogging();
        })
        .then(function(){
            console.log('chownBindDir');                        
            return chownBindDir();
        })
        .then(function(){
            console.log('restartBind');                        
            return restartBind();
        })        
        .then(function(){
            deferred.resolve();
        });

        // backup /etc/bind/named.conf.local

        /*
        rm -f /etc/bind/named.conf.local

        touch /etc/bind/named.conf.local
        chown bind:bind /etc/bind/named.conf.local

        echo "// generated by samisdat/ddns" > /etc/bind/named.conf.local


        read_key
        read_configs

        #enable_logging

        # this is needed or *.jnl can not be created
        chown bind:bind /etc/bind

        service bind9 restart
        */

        return deferred.promise;
    };

    return{
        createKey:createKey,
        readKey:readKey,
        removeConfLocal: removeConfLocal,
        createConfLocal: createConfLocal,
        backupConfLocal: backupConfLocal,
        addKeyToConfLocal: addKeyToConfLocal,
        createZone: createZone,
        createZones: createZones,
        enableLogging: enableLogging,
        chownBindDir: chownBindDir,
        firstSetup: firstSetup
    };

};
