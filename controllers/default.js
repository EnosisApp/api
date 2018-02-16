'use strict';

const ElasticHelper = require('../business/elasticHelper.js');
const eh = new ElasticHelper();

module.exports.controller = function(router) {
    router.get('/', function(req, res) {
        res.end('done');
    });
    
    router.post('/api/v2/getPois', function(req, res) {
        eh.getPoisInBounds(req.body, resp => {
            res.json(resp);
        })
    });

    router.get('/api/v2/getPoi/:id', function(req, res) {
        eh.getPoiInfos(req.params.id, resp => {
            res.json(resp);
        });
    });

    router.post('/api/v2/session/start', function(req, res) {
        let handicap = req.body.prefs.handicap;
        delete req.body.prefs.handicap;
        let age = req.body.prefs.age;
        delete req.body.prefs.age;
        
        eh.startSession({
            poi: req.body.poi,
            handicap: handicap,
            age: age,
            prefs: req.body.prefs
        }, resp => {
            res.json({'id': resp['_id']});
        });
    });

    router.post('/api/v2/session/heartbeat', function(req, res) {
        eh.heartbeatSession(req.body.session_id, resp => {
            res.json({'success': true});
        });
    });

    router.post('/api/v2/session/stop', function(req, res) {
        eh.stopSession(req.body.session_id, resp => {
            res.json({'success': true});
        });
    });

    router.get('/api/v2/poi/:id', function(req, res) {
        eh.getPoi(req.params.id, poi => {
            res.json(poi);
        });
    });

    router.get('/api/v2/poiByBeacon/:name', function(req, res) {
        eh.getPoiByBeacon(req.params.name, poi => {
            res.json(poi);
        });
    });
}
