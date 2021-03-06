defineSuite([
        'Core/CesiumTerrainProvider',
        'Core/DefaultProxy',
        'Core/Ellipsoid',
        'Core/GeographicTilingScheme',
        'Core/getAbsoluteUri',
        'Core/HeightmapTerrainData',
        'Core/Math',
        'Core/QuantizedMeshTerrainData',
        'Core/Request',
        'Core/RequestScheduler',
        'Core/Resource',
        'Core/TerrainProvider',
        'Specs/pollToPromise',
        'ThirdParty/when'
    ], function(
        CesiumTerrainProvider,
        DefaultProxy,
        Ellipsoid,
        GeographicTilingScheme,
        getAbsoluteUri,
        HeightmapTerrainData,
        CesiumMath,
        QuantizedMeshTerrainData,
        Request,
        RequestScheduler,
        Resource,
        TerrainProvider,
        pollToPromise,
        when) {
    'use strict';

    beforeEach(function() {
        RequestScheduler.clearForSpecs();
    });

    afterEach(function() {
        Resource._Implementations.loadWithXhr = Resource._DefaultImplementations.loadWithXhr;
    });

    function returnTileJson(path) {
        var oldLoad = Resource._Implementations.loadWithXhr;
        Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
            if (url.indexOf('layer.json') >= 0) {
                Resource._DefaultImplementations.loadWithXhr(path, responseType, method, data, headers, deferred);
            } else {
                return oldLoad(url, responseType, method, data, headers, deferred, overrideMimeType);
            }
        };
    }

    function returnHeightmapTileJson() {
        return returnTileJson('Data/CesiumTerrainTileJson/StandardHeightmap.tile.json');
    }

    function returnQuantizedMeshTileJson() {
        return returnTileJson('Data/CesiumTerrainTileJson/QuantizedMesh.tile.json');
    }

    function returnVertexNormalTileJson() {
        return returnTileJson('Data/CesiumTerrainTileJson/VertexNormals.tile.json');
    }

    function returnOctVertexNormalTileJson() {
        return returnTileJson('Data/CesiumTerrainTileJson/OctVertexNormals.tile.json');
    }

    function returnWaterMaskTileJson() {
        return returnTileJson('Data/CesiumTerrainTileJson/WaterMask.tile.json');
    }

    function returnPartialAvailabilityTileJson() {
        return returnTileJson('Data/CesiumTerrainTileJson/PartialAvailability.tile.json');
    }

    function returnParentUrlTileJson() {
        var paths = ['Data/CesiumTerrainTileJson/ParentUrl.tile.json',
                     'Data/CesiumTerrainTileJson/Parent.tile.json'];
        var i = 0;
        var oldLoad = Resource._Implementations.loadWithXhr;
        Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
            if (url.indexOf('layer.json') >= 0) {
                Resource._DefaultImplementations.loadWithXhr(paths[i++], responseType, method, data, headers, deferred);
            } else {
                return oldLoad(url, responseType, method, data, headers, deferred, overrideMimeType);
            }
        };
    }

    function waitForTile(level, x, y, requestNormals, requestWaterMask, f) {
        var terrainProvider = new CesiumTerrainProvider({
            url : 'made/up/url',
            requestVertexNormals : requestNormals,
            requestWaterMask: requestWaterMask
        });

        return pollToPromise(function() {
            return terrainProvider.ready;
        }).then(function() {
            var promise = terrainProvider.requestTileGeometry(level, x, y);

            return when(promise, f, function(error) {
                expect('requestTileGeometry').toBe('returning a tile.'); // test failure
            });
        });
    }

    function createRequest() {
        return new Request({
            throttleByServer : true
        });
    }

    it('conforms to TerrainProvider interface', function() {
        expect(CesiumTerrainProvider).toConformToInterface(TerrainProvider);
    });

    it('constructor throws if url is not provided', function() {
        expect(function() {
            return new CesiumTerrainProvider();
        }).toThrowDeveloperError();

        expect(function() {
            return new CesiumTerrainProvider({
            });
        }).toThrowDeveloperError();
    });

    it('resolves readyPromise', function() {
        var provider = new CesiumTerrainProvider({
            url : 'made/up/url'
        });

        return provider.readyPromise.then(function (result) {
            expect(result).toBe(true);
            expect(provider.ready).toBe(true);
        });
    });

    it('resolves readyPromise when url promise is used', function() {
        var provider = new CesiumTerrainProvider({
            url : when.resolve('made/up/url')
        });

        return provider.readyPromise.then(function (result) {
            expect(result).toBe(true);
            expect(provider.ready).toBe(true);
        });
    });

    it('resolves readyPromise with Resource', function() {
        var resource = new Resource({
            url : 'made/up/url'
        });

        var provider = new CesiumTerrainProvider({
            url : resource
        });

        return provider.readyPromise.then(function (result) {
            expect(result).toBe(true);
            expect(provider.ready).toBe(true);
        });
    });

    it('rejects readyPromise when url rejects', function() {
        var error = new Error();
        var provider = new CesiumTerrainProvider({
            url: when.reject(error)
        });
        return provider.readyPromise
            .then(function() {
                fail('should not resolve');
            })
            .otherwise(function(result) {
                expect(result).toBe(error);
                expect(provider.ready).toBe(false);
            });
    });

    it('uses geographic tiling scheme by default', function() {
        returnHeightmapTileJson();

        var provider = new CesiumTerrainProvider({
            url : 'made/up/url'
        });

        return pollToPromise(function() {
            return provider.ready;
        }).then(function() {
            var tilingScheme = provider.tilingScheme;
            expect(tilingScheme instanceof GeographicTilingScheme).toBe(true);
        });
    });

    it('can use a custom ellipsoid', function() {
        returnHeightmapTileJson();

        var ellipsoid = new Ellipsoid(1, 2, 3);
        var provider = new CesiumTerrainProvider({
            url : 'made/up/url',
            ellipsoid : ellipsoid
        });

        return pollToPromise(function() {
            return provider.ready;
        }).then(function() {
            expect(provider.tilingScheme.ellipsoid).toEqual(ellipsoid);
        });
    });

    it('has error event', function() {
        var provider = new CesiumTerrainProvider({
            url : 'made/up/url'
        });
        expect(provider.errorEvent).toBeDefined();
        expect(provider.errorEvent).toBe(provider.errorEvent);
    });

    it('returns reasonable geometric error for various levels', function() {
        var provider = new CesiumTerrainProvider({
            url : 'made/up/url'
        });

        expect(provider.getLevelMaximumGeometricError(0)).toBeGreaterThan(0.0);
        expect(provider.getLevelMaximumGeometricError(0)).toEqualEpsilon(provider.getLevelMaximumGeometricError(1) * 2.0, CesiumMath.EPSILON10);
        expect(provider.getLevelMaximumGeometricError(1)).toEqualEpsilon(provider.getLevelMaximumGeometricError(2) * 2.0, CesiumMath.EPSILON10);
    });

    it('logo is undefined if credit is not provided', function() {
        returnHeightmapTileJson();

        var provider = new CesiumTerrainProvider({
            url : 'made/up/url'
        });

        return pollToPromise(function() {
            return provider.ready;
        }).then(function() {
            expect(provider.credit).toBeUndefined();
        });
    });

    it('logo is defined if credit is provided', function() {
        returnHeightmapTileJson();

        var provider = new CesiumTerrainProvider({
            url : 'made/up/url',
            credit : 'thanks to our awesome made up contributors!'
        });

        return pollToPromise(function() {
            return provider.ready;
        }).then(function() {
            expect(provider.credit).toBeDefined();
        });
    });

    it('has a water mask', function() {
        returnHeightmapTileJson();

        var provider = new CesiumTerrainProvider({
            url : 'made/up/url'
        });

        return pollToPromise(function() {
            return provider.ready;
        }).then(function() {
            expect(provider.hasWaterMask).toBe(true);
        });
    });

    it('has vertex normals', function() {
        returnOctVertexNormalTileJson();

        var provider = new CesiumTerrainProvider({
            url : 'made/up/url',
            requestVertexNormals : true
        });

        return pollToPromise(function() {
            return provider.ready;
        }).then(function() {
            expect(provider.requestVertexNormals).toBe(true);
            expect(provider.hasVertexNormals).toBe(true);
        });
    });

    it('does not request vertex normals', function() {
        returnOctVertexNormalTileJson();

        var provider = new CesiumTerrainProvider({
            url : 'made/up/url',
            requestVertexNormals : false
        });

        return pollToPromise(function() {
            return provider.ready;
        }).then(function() {
            expect(provider.requestVertexNormals).toBe(false);
            expect(provider.hasVertexNormals).toBe(false);
        });
    });

    it('requests parent layer.json', function() {
        returnParentUrlTileJson();

        var provider = new CesiumTerrainProvider({
            url : 'made/up/url',
            requestVertexNormals : true,
            requestWaterMask : true
        });

        return pollToPromise(function() {
            return provider.ready;
        }).then(function() {
            expect(provider._tileCredits[0].text).toBe('This is a child tileset! This amazing data is courtesy The Amazing Data Source!');
            expect(provider.requestVertexNormals).toBe(true);
            expect(provider.requestWaterMask).toBe(true);
            expect(provider.hasVertexNormals).toBe(false); // Neither tileset has them
            expect(provider.hasWaterMask).toBe(true); // The child tileset has them
            expect(provider.availability.isTileAvailable(1, 2, 1)).toBe(true); // Both have this
            expect(provider.availability.isTileAvailable(1, 3, 1)).toBe(true); // Parent has this, but child doesn't
            expect(provider.availability.isTileAvailable(2, 0, 0)).toBe(false); // Neither has this

            var layers = provider._layers;
            expect(layers.length).toBe(2);
            expect(layers[0].hasVertexNormals).toBe(false);
            expect(layers[0].hasWaterMask).toBe(true);
            expect(layers[0].availability.isTileAvailable(1, 2, 1)).toBe(true);
            expect(layers[0].availability.isTileAvailable(1, 3, 1)).toBe(false);
            expect(layers[0].availability.isTileAvailable(2, 0, 0)).toBe(false);
            expect(layers[1].hasVertexNormals).toBe(false);
            expect(layers[1].hasWaterMask).toBe(false);
            expect(layers[1].availability.isTileAvailable(1, 2, 1)).toBe(true);
            expect(layers[1].availability.isTileAvailable(1, 3, 1)).toBe(true);
            expect(layers[1].availability.isTileAvailable(2, 0, 0)).toBe(false);
        });
    });

    it('raises an error if layer.json does not specify a format', function() {
        returnTileJson('Data/CesiumTerrainTileJson/NoFormat.tile.json');

        var provider = new CesiumTerrainProvider({
            url : 'made/up/url'
        });

        var deferred = when.defer();

        provider.errorEvent.addEventListener(function(e) {
            deferred.resolve(e);
        });

        return deferred.promise.then(function(error) {
            expect(error.message).toContain('format is not specified');
        });
    });

    it('raises an error if layer.json specifies an unknown format', function() {
        returnTileJson('Data/CesiumTerrainTileJson/InvalidFormat.tile.json');

        var provider = new CesiumTerrainProvider({
            url : 'made/up/url'
        });

        var deferred = when.defer();

        provider.errorEvent.addEventListener(function(e) {
            deferred.resolve(e);
        });

        return deferred.promise.then(function(error) {
            expect(error.message).toContain('invalid or not supported');
        });
    });

    it('raises an error if layer.json does not specify quantized-mesh 1.x format', function() {
        returnTileJson('Data/CesiumTerrainTileJson/QuantizedMesh2.0.tile.json');

        var provider = new CesiumTerrainProvider({
            url : 'made/up/url'
        });

        var deferred = when.defer();

        provider.errorEvent.addEventListener(function(e) {
            deferred.resolve(e);
        });

        return deferred.promise.then(function(error) {
            expect(error.message).toContain('invalid or not supported');
        });
    });

    it('supports quantized-mesh1.x minor versions', function() {
        returnTileJson('Data/CesiumTerrainTileJson/QuantizedMesh1.1.tile.json');

        var provider = new CesiumTerrainProvider({
            url : 'made/up/url'
        });

        var errorListener = jasmine.createSpy('error');
        provider.errorEvent.addEventListener(errorListener);

        return pollToPromise(function() {
            return provider.ready;
        }).then(function() {
            expect(errorListener).not.toHaveBeenCalled();
        });
    });

    it('raises an error if layer.json does not specify a tiles property', function() {
        returnTileJson('Data/CesiumTerrainTileJson/NoTiles.tile.json');

        var provider = new CesiumTerrainProvider({
            url : 'made/up/url'
        });

        var deferred = when.defer();

        provider.errorEvent.addEventListener(function(e) {
            deferred.resolve(e);
        });

        return deferred.promise.then(function(error) {
            expect(error.message).toContain('does not specify any tile URL templates');
        });
    });

    it('raises an error if layer.json tiles property is an empty array', function() {
        returnTileJson('Data/CesiumTerrainTileJson/EmptyTilesArray.tile.json');

        var provider = new CesiumTerrainProvider({
            url : 'made/up/url'
        });

        var deferred = when.defer();

        provider.errorEvent.addEventListener(function(e) {
            deferred.resolve(e);
        });

        return deferred.promise.then(function(error) {
            expect(error.message).toContain('does not specify any tile URL templates');
        });
    });

    it('uses attribution specified in layer.json', function() {
        returnTileJson('Data/CesiumTerrainTileJson/WithAttribution.tile.json');

        var provider = new CesiumTerrainProvider({
            url : 'made/up/url'
        });

        return pollToPromise(function() {
            return provider.ready;
        }).then(function() {
            expect(provider._tileCredits[0].text).toBe('This amazing data is courtesy The Amazing Data Source!');
        });
    });

    describe('requestTileGeometry', function() {

        it('uses multiple urls specified in layer.json', function() {
            returnTileJson('Data/CesiumTerrainTileJson/MultipleUrls.tile.json');

            var provider = new CesiumTerrainProvider({
                url : 'made/up/url'
            });

            return pollToPromise(function() {
                return provider.ready;
            }).then(function() {
                spyOn(Resource._Implementations, 'loadWithXhr');
                provider.requestTileGeometry(0, 0, 0);
                expect(Resource._Implementations.loadWithXhr.calls.mostRecent().args[0]).toContain('foo0.com');
                provider.requestTileGeometry(1, 0, 0);
                expect(Resource._Implementations.loadWithXhr.calls.mostRecent().args[0]).toContain('foo1.com');
                provider.requestTileGeometry(1, -1, 0);
                expect(Resource._Implementations.loadWithXhr.calls.mostRecent().args[0]).toContain('foo2.com');
                provider.requestTileGeometry(1, 0, 1);
                expect(Resource._Implementations.loadWithXhr.calls.mostRecent().args[0]).toContain('foo3.com');
            });
        });

        it('supports scheme-less template URLs in layer.json resolved with absolute URL', function() {
            returnTileJson('Data/CesiumTerrainTileJson/MultipleUrls.tile.json');

            var url = getAbsoluteUri('Data/CesiumTerrainTileJson');

            var provider = new CesiumTerrainProvider({
                url : url
            });

            return pollToPromise(function() {
                return provider.ready;
            }).then(function() {
                spyOn(Resource._Implementations, 'loadWithXhr');
                provider.requestTileGeometry(0, 0, 0);
                expect(Resource._Implementations.loadWithXhr.calls.mostRecent().args[0]).toContain('foo0.com');
                provider.requestTileGeometry(1, 0, 0);
                expect(Resource._Implementations.loadWithXhr.calls.mostRecent().args[0]).toContain('foo1.com');
                provider.requestTileGeometry(1, -1, 0);
                expect(Resource._Implementations.loadWithXhr.calls.mostRecent().args[0]).toContain('foo2.com');
                provider.requestTileGeometry(1, 0, 1);
                expect(Resource._Implementations.loadWithXhr.calls.mostRecent().args[0]).toContain('foo3.com');
            });
        });

        it('uses the proxy if one is supplied', function() {
            var baseUrl = 'made/up/url';

            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                expect(url.indexOf('/proxy/?')).toBe(0);

                // Just return any old file, as long as its big enough
                Resource._DefaultImplementations.loadWithXhr('Data/EarthOrientationParameters/IcrfToFixedStkComponentsRotationData.json', responseType, method, data, headers, deferred);
            };

            returnHeightmapTileJson();

            var terrainProvider = new CesiumTerrainProvider({
                url : baseUrl,
                proxy : new DefaultProxy('/proxy/')
            });

            return pollToPromise(function() {
                return terrainProvider.ready;
            }).then(function() {
                return terrainProvider.requestTileGeometry(0, 0, 0);
            });
        });

        it('provides HeightmapTerrainData', function() {
            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                // Just return any old file, as long as its big enough
                Resource._DefaultImplementations.loadWithXhr('Data/EarthOrientationParameters/IcrfToFixedStkComponentsRotationData.json', responseType, method, data, headers, deferred);
            };

            returnHeightmapTileJson();

            return waitForTile(0, 0, 0, false, false, function(loadedData) {
                expect(loadedData).toBeInstanceOf(HeightmapTerrainData);
            });
        });

        it('provides QuantizedMeshTerrainData', function() {
            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                Resource._DefaultImplementations.loadWithXhr('Data/CesiumTerrainTileJson/tile.terrain', responseType, method, data, headers, deferred);
            };

            returnQuantizedMeshTileJson();

            return waitForTile(0, 0, 0, false, false, function(loadedData) {
                expect(loadedData).toBeInstanceOf(QuantizedMeshTerrainData);
            });
        });

        it('provides QuantizedMeshTerrainData with 32bit indices', function() {
            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                Resource._DefaultImplementations.loadWithXhr('Data/CesiumTerrainTileJson/tile.32bitIndices.terrain', responseType, method, data, headers, deferred);
            };

            returnQuantizedMeshTileJson();

            return waitForTile(0, 0, 0, false, false, function(loadedData) {
                expect(loadedData).toBeInstanceOf(QuantizedMeshTerrainData);
                expect(loadedData._indices.BYTES_PER_ELEMENT).toBe(4);
            });
        });

        it('provides QuantizedMeshTerrainData with VertexNormals', function() {
            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                Resource._DefaultImplementations.loadWithXhr('Data/CesiumTerrainTileJson/tile.vertexnormals.terrain', responseType, method, data, headers, deferred);
            };

            returnVertexNormalTileJson();

            return waitForTile(0, 0, 0, true, false, function(loadedData) {
                expect(loadedData).toBeInstanceOf(QuantizedMeshTerrainData);
                expect(loadedData._encodedNormals).toBeDefined();
            });
        });

        it('provides QuantizedMeshTerrainData with WaterMask', function() {
            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                Resource._DefaultImplementations.loadWithXhr('Data/CesiumTerrainTileJson/tile.watermask.terrain', responseType, method, data, headers, deferred);
            };

            returnWaterMaskTileJson();

            return waitForTile(0, 0, 0, false, true, function(loadedData) {
                expect(loadedData).toBeInstanceOf(QuantizedMeshTerrainData);
                expect(loadedData._waterMask).toBeDefined();
            });
        });

        it('provides QuantizedMeshTerrainData with VertexNormals and WaterMask', function() {
            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                Resource._DefaultImplementations.loadWithXhr('Data/CesiumTerrainTileJson/tile.octvertexnormals.watermask.terrain', responseType, method, data, headers, deferred);
            };

            returnWaterMaskTileJson();

            return waitForTile(0, 0, 0, true, true, function(loadedData) {
                expect(loadedData).toBeInstanceOf(QuantizedMeshTerrainData);
                expect(loadedData._encodedNormals).toBeDefined();
                expect(loadedData._waterMask).toBeDefined();
            });
        });

        it('provides QuantizedMeshTerrainData with OctVertexNormals', function() {
            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                Resource._DefaultImplementations.loadWithXhr('Data/CesiumTerrainTileJson/tile.octvertexnormals.terrain', responseType, method, data, headers, deferred);
            };

            returnOctVertexNormalTileJson();

            return waitForTile(0, 0, 0, true, false, function(loadedData) {
                expect(loadedData).toBeInstanceOf(QuantizedMeshTerrainData);
                expect(loadedData._encodedNormals).toBeDefined();
            });
        });

        it('provides QuantizedMeshTerrainData with VertexNormals and unknown extensions', function() {
            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                Resource._DefaultImplementations.loadWithXhr('Data/CesiumTerrainTileJson/tile.vertexnormals.unknownext.terrain', responseType, method, data, headers, deferred);
            };

            returnVertexNormalTileJson();

            return waitForTile(0, 0, 0, true, false, function(loadedData) {
                expect(loadedData).toBeInstanceOf(QuantizedMeshTerrainData);
                expect(loadedData._encodedNormals).toBeDefined();
            });
        });

        it('provides QuantizedMeshTerrainData with OctVertexNormals and unknown extensions', function() {
            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                Resource._DefaultImplementations.loadWithXhr('Data/CesiumTerrainTileJson/tile.octvertexnormals.unknownext.terrain', responseType, method, data, headers, deferred);
            };

            returnOctVertexNormalTileJson();

            return waitForTile(0, 0, 0, true, false, function(loadedData) {
                expect(loadedData).toBeInstanceOf(QuantizedMeshTerrainData);
                expect(loadedData._encodedNormals).toBeDefined();
            });
        });

        it('provides QuantizedMeshTerrainData with unknown extension', function() {
            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                Resource._DefaultImplementations.loadWithXhr('Data/CesiumTerrainTileJson/tile.unknownext.terrain', responseType, method, data, headers, deferred);
            };

            returnOctVertexNormalTileJson();

            return waitForTile(0, 0, 0, false, false, function(loadedData) {
                expect(loadedData).toBeInstanceOf(QuantizedMeshTerrainData);
            });
        });

        it('returns undefined if too many requests are already in progress', function() {
            var baseUrl = 'made/up/url';

            var deferreds = [];

            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                // Do nothing, so requests never complete
                deferreds.push(deferred);
            };

            returnHeightmapTileJson();

            var terrainProvider = new CesiumTerrainProvider({
                url : baseUrl
            });

            return pollToPromise(function() {
                return terrainProvider.ready;
            }).then(function() {
                var promise;
                var i;
                for (i = 0; i < RequestScheduler.maximumRequestsPerServer; ++i) {
                    promise = terrainProvider.requestTileGeometry(0, 0, 0, createRequest());
                }
                RequestScheduler.update();
                expect(promise).toBeDefined();

                promise = terrainProvider.requestTileGeometry(0, 0, 0, createRequest());
                expect(promise).toBeUndefined();

                for (i = 0; i < deferreds.length; ++i) {
                    deferreds[i].resolve();
                }
            });
        });

        it('supports getTileDataAvailable()', function() {
            var baseUrl = 'made/up/url';

            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                Resource._DefaultImplementations.loadWithXhr('Data/CesiumTerrainTileJson/tile.terrain', responseType, method, data, headers, deferred);
            };

            returnQuantizedMeshTileJson();

            var terrainProvider = new CesiumTerrainProvider({
                url : baseUrl
            });

            return pollToPromise(function() {
                return terrainProvider.ready;
            }).then(function() {
                expect(terrainProvider.getTileDataAvailable(0, 0, 0)).toBe(true);
                expect(terrainProvider.getTileDataAvailable(0, 0, 2)).toBe(false);
            });
        });

        it('getTileDataAvailable() converts xyz to tms', function() {
            var baseUrl = 'made/up/url';

            returnPartialAvailabilityTileJson();

            var terrainProvider = new CesiumTerrainProvider({
                url : baseUrl
            });

            return pollToPromise(function() {
                return terrainProvider.ready;
            }).then(function() {
                expect(terrainProvider.getTileDataAvailable(1, 3, 2)).toBe(true);
                expect(terrainProvider.getTileDataAvailable(1, 0, 2)).toBe(false);
            });
        });

        it('supports a query string in the base URL', function() {
            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                // Just return any old file, as long as its big enough
                Resource._DefaultImplementations.loadWithXhr('Data/EarthOrientationParameters/IcrfToFixedStkComponentsRotationData.json', responseType, method, data, headers, deferred);
            };

            returnHeightmapTileJson();

            return waitForTile(0, 0, 0, false, false, function(loadedData) {
                expect(loadedData).toBeInstanceOf(HeightmapTerrainData);
            });
        });
    });
});
