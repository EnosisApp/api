const es = require('elasticsearch');
const esConfig = require('../config/elasticsearch.json');
const moment = require('moment');
const config = require('../config/config');

class ElasticHelper
{
    _getClient() {
        return new es.Client({
            host: esConfig.host
        });
    }

    getPoisInBounds(params, cb) {
        var query = {
            bool: {
                filter: {
                    geo_bounding_box: {
                        location: {
                            top_left: {
                                lat: params.bounds.northwest.lat,
                                lon: params.bounds.northwest.lng
                            },
                            bottom_right: {
                                lat: params.bounds.southeast.lat,
                                lon: params.bounds.southeast.lng
                            }
                        }
                    }
                }
            }
        };

        query.bool.must = {};
        if(params.accessible) {
            query.bool.must.term = {
                accessible: true
            };
        }

        if(params.categories && params.categories.length) {
            query.bool.must.terms = {
                type: params.categories
            };
        }

        var body = {
            size: 10000,
            query: query
        };

        function lngDiff() {
            return params.bounds.southeast.lng - params.bounds.northwest.lng;
        }

        if(lngDiff() > 0.3) {
            body.aggs = {
                cities: {
                    terms: {
                        field: 'city'
                    }
                }
            };
        }

        function countTransform(c) {
            if(c > 1000)
                return Math.floor(c/1000) + 'k';
            else if(c > 100)
                return Math.floor(x/100)*100;
            return c;
        }

        this._getClient().search({
            index: 'app',
            type: 'poi',
            body: body
        }).then(resp => {
            var cities = [];
            if(lngDiff() > 0.3) {
                resp.aggregations.cities.buckets.forEach(b => {
                    let latlon = b.key.split(';');
                    cities.push({
                        lat: latlon[0],
                        lon: latlon[1],
                        count: countTransform(b.doc_count),
                        type: 'city'
                    });
                });
            } else {
                resp.hits.hits.forEach(p => {
                    cities.push({
                        id: p._id,
                        lat: p._source.location.lat,
                        lon: p._source.location.lon,
                        type: p._source.type,
                        caption: p._source.caption,
                        address: p._source.address
                    });
                });
            }
            cb(cities);
        });
    }

    getPoiInfos(id, cb) {
        var body = {
            query: {
                function_score: {
                    query: {
                        bool: {
                            must: [
                                {
                                    term: {
                                        poi: {
                                            value: id
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    functions: [
                        {
                            gauss: {
                                start: {
                                    origin: moment().format('YYYY-MM-DD 00:00:00 ZZ'),
                                    scale: '5d',
                                    offset: '2d',
                                    decay: 0.5
                                }
                            }
                        }
                    ],
                    boost_mode: 'replace'
                }
            },
            aggs: {
                interests: {
                    nested: {
                        path: 'prefs'
                    },
                    aggs: {}
                },
                age: {
                    terms: {
                        field: 'age'
                    },
                    aggs: {
                        score: {
                            sum: {
                                script: {
                                    inline: '_score'
                                }
                            }
                        }
                    }
                }
            }
        };

        
        config.interestCats.forEach(cat => {
            body.aggs.interests.aggs[cat] = {
                terms: {
                    field: 'prefs.' + cat
                },
                aggs: {
                    score: {
                        sum: {
                            script: {
                                inline: '_score'
                            }
                        }
                    }
                }
            };
        });

        this._getClient().search({
            index: 'app',
            type: 'session',
            body: body
        }).then(infos => {
            var ret = {};
            var age = {};

            Object.keys(infos.aggregations.interests).forEach(cat => {
                if(['doc_count'].indexOf(cat) != -1)
                    return;
                var info = infos.aggregations.interests[cat];
                ret[cat] = {};
                info.buckets.forEach(bucket => {
                    ret[cat][bucket.key] = bucket.score.value;
                });

                var sortable = [];
                for (var interest in ret[cat])
                    sortable.push([interest, ret[cat][interest]]);

                sortable.sort((a, b) => {
                    return b[1]-a[1];
                });

                sortable = sortable.slice(0, 5);

                ret[cat] = {};
                sortable.forEach(e => {
                    ret[cat][e[0]] = e[1];
                });
            });


            Object.keys(infos.aggregations.age.buckets).forEach(key => {
                var bucket = infos.aggregations.age.buckets[key];
                if(bucket.key)
                    age[bucket.key] = bucket.score.value;
            });

            cb({
                code: 200,
                infos: ret,
                age: age
            });
        });
    }

    startSession(params, cb) {
        this.getPoi(params.poi, poi => {
            this._getClient().index({
                index: 'app',
                type: 'session',
                body: {
                    poi: params.poi,
                    start: moment().format('YYYY-MM-DD HH:mm:ss ZZ'),
                    handicap: params.handicap,
                    age: params.age,
                    prefs: params.prefs,
                    location: poi.location
                }
            }).then(resp => {
                cb(resp);
            });
        })
    }

    heartbeatSession(id, cb) {
        this._getClient().update({
            index: 'app',
            type: 'session',
            id: id,
            body: {
                doc: {
                    last_heartbeat: moment().format('YYYY-MM-DD HH:mm:ss ZZ')
                }
            }
        }).then(resp => {
            cb();
        });
    }

    stopSession(id, cb) {
        this._getClient().update({
            index: 'app',
            type: 'session',
            id: id,
            body: {
                doc: {
                    stop: moment().format('YYYY-MM-DD HH:mm:ss ZZ')
                }
            }
        }).then(resp => {
            cb();
        });
    }

    getPoi(id, cb) {
        this._getClient().get({
            index: 'app',
            type: 'poi',
            id: id
        }).then(resp => {
            cb(resp._source);
        });
    }

    getPoiByBeacon(name, cb) {
        this._getClient().search({
            index: 'app',
            type: 'poi',
            body: {
                query: {
                    bool: {
                        should: [
                            {
                                match: {
                                    beacons: name
                                }
                            }
                        ]
                    }
                }
            }
        }).then(ret => {
            cb((ret.hits.hits.length) ? ret.hits.hits[0] : {});
        });
    }
}

module.exports = ElasticHelper;
