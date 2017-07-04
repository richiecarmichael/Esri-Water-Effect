/*
    Copyright 2017 Esri

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at:
    https://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/
require(
    {
        packages: [{
            name: 'water',
            location: document.location.pathname + '/../water'
        }]
    }, [
        'water/ThreeRenderer',
        'water/WaterRenderer',
        'esri/views/SceneView',
        'esri/Map',
        'esri/layers/SceneLayer',
        'esri/renderers/SimpleRenderer',
        'esri/symbols/MeshSymbol3D',
        'esri/symbols/FillSymbol3DLayer',
        'esri/tasks/QueryTask',
        'esri/tasks/support/Query',
        'dojo/domReady!'
    ],
    function (
        ThreeRenderer,
        WaterRenderer,
        SceneView,
        Map,
        SceneLayer,
        SimpleRenderer,
        MeshSymbol3D,
        FillSymbol3DLayer,
        QueryTask,
        Query
    ) {
        $(document).ready(function () {
            // Enforce strict mode
            'use strict';

            // URL to buildings
            var BUILDINGS = 'https://services7.arcgis.com/wdgKFvvZvYZ3Biji/ArcGIS/rest/services/LOD2Buildings/SceneServer/layers/0';

            // Entry point to the three.js rendering framework
            var _threeRenderer = null;

            // Define map
            var _view = new SceneView({
                container: 'map',
                camera: {
                    position: {
                        x: -8529429,
                        y: 4762978,
                        z: 566,
                        spatialReference: {
                            wkid: 102100
                        }
                    },
                    heading: 110,
                    tilt: 63
                },
                map: new Map({
                    basemap: 'dark-gray',
                    layers: [
                        new SceneLayer({
                            id: 'buildings-under',
                            url: BUILDINGS,
                            definitionExpression: 'BASEELEV <= 0',
                            renderer: new SimpleRenderer({
                                symbol: new MeshSymbol3D({
                                    symbolLayers: [
                                        new FillSymbol3DLayer({
                                            material: {
                                                color: [255, 0, 0, 0.3]
                                            }
                                        })
                                    ]
                                })
                            })
                        }),
                        new SceneLayer({
                            id: 'buildings-over',
                            url: BUILDINGS,
                            definitionExpression: 'BASEELEV > 0',
                            renderer: new SimpleRenderer({
                                symbol: new MeshSymbol3D({
                                    symbolLayers: [
                                        new FillSymbol3DLayer({
                                            material: {
                                                color: [255, 255, 255, 0.3]
                                            }
                                        })
                                    ]
                                })
                            })
                        })
                    ]
                })
            });

            // Perform display setup once the map is located.
            _view.then(function () {
                // Continue to refresh the display even if stationary.
                _view._stage.setRenderParams({
                    idleSuspend: false
                });

                // Load water
                LoadWater();
            });

            //
            $('.button').click(function () {
                // Exit if item already selected.
                if ($(this).hasClass('active')) { return; }

                // Toggle enabled state for clicked item and siblings.
                $(this).addClass('active');
                $(this).siblings().removeClass('active');

                // Load water
                LoadWater();
                UpdateBuildings();
            });

            // Load/reload water three.js layer
            function LoadWater() {
                // Initialize the three.js renderering framework.
                if (_threeRenderer) {
                    _threeRenderer.destroy();
                    _threeRenderer = null;
                }
                _threeRenderer = new ThreeRenderer(_view);

                // Get url to water level
                var url = $('.button.active').attr('data-url');

                // Download water polygons
                var query = new Query({
                    where: '1=1',
                    returnGeometry: true
                });
                var queryTask = new QueryTask({
                    url: url
                });
                queryTask.execute(query).then(function (result) {
                    var features = result.features;
                    var water = new WaterRenderer(_view, features[0].geometry, function (x, y, z) {
                        return 5;
                    });
                    _threeRenderer.add(water);
                });
            }

            // Update building symbology
            function UpdateBuildings() {
                var ele = $('.button.active').attr('data-elevation');
                _view.map.findLayerById('buildings-under').definitionExpression = 'BASEELEV <= ' + ele;
                _view.map.findLayerById('buildings-over').definitionExpression = 'BASEELEV > ' + ele;
            }
        });
    }
);
