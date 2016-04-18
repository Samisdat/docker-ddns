'use strict';

var mochaIstanbul = {
    all: {
        src: [
            'test/lib/qexec.js',
            'test/lib/qfs.js',
            'test/lib/server.js'
        ]
    },
    server: {
        src: [
            'test/lib/server.js'
        ]
    }
};

module.exports = mochaIstanbul;
