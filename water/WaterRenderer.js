define([
    "esri/core/declare",
    "esri/core/HandleRegistry",
    "esri/geometry/geometryEngine",
    "esri/geometry/Extent",
    "esri/geometry/Point",
    "esri/views/3d/externalRenderers",
    "esri/views/3d/layers/graphics/earcut/earcut",
    "dojo/text!./shaders/water-glvs.txt",
    "dojo/text!./shaders/water-glfs.txt",
    "dojo/text!./textures/noise-b64.txt",
    "dojo/text!./textures/reflection-b64.txt"
], function (
    declare,
    HandleRegistry,
    geometryEngine,
    Extent,
    Point,
    externalRenderers,
    earcut,
    waterGLVS,
    waterGLFS,
    noiseB64,
    reflectionB64
) {
        var THREE = window.THREE;

        var WaterRenderer = declare([], {
            constructor: function (view, polygon, elevationSampler) {
                this.view = view;

                //polygon = this._subdivide(polygon, 0.5, 3);

                var sampler = function (x, y) {
                    return elevationSampler(x, y, 0.3);
                };

                var inner = this._tesselatePolygonOnGrid(polygon, 30, sampler);
                var outer = this._tesselateBufferedBorder(polygon, sampler);

                this.geometry = this._makeGeometry(inner.vertices.concat(outer.vertices), outer.polygon.extent);
                this.geometry = this._makeGeometry(inner.vertices, inner.polygon.extent);

                this.handles = new HandleRegistry();

                //this.color = [0.1, 0.3, 0.3];
                this.color = [57/255, 168/255, 168/255];
                this.enabled = true;
                this.velocity = 0.2;
                this.waveSize = 0.2;
            },

            setup: function () {
                this.scene = new THREE.Scene();
                this.camera = new THREE.PerspectiveCamera();

                this._setupScene();

                // var mesh = new THREE.Mesh(this.geometry.geometry);
                // var wireframe = new THREE.WireframeHelper(mesh, 0xff0000);

                // this.scene.add(cube);
                //this.scene.add(wireframe);
            },

            _subdivide: function (polygon, factor, N) {
                factor = factor || 0.5;
                N = N || 1;

                for (var n = 0; n < N; n++) {
                    var newpts = [];
                    var ring = polygon.rings[0];
                    var prevsub;

                    for (var i = 1; i < ring.length; i++) {
                        var prev = ring[i - 1];
                        var cur = ring[i];

                        var sub = [(prev[0] + cur[0]) / 2, (prev[1] + cur[1]) / 2];

                        if (prevsub) {
                            // Adjust prev
                            var avgX = (prevsub[0] + sub[0]) / 2;
                            var avgY = (prevsub[1] + sub[1]) / 2;

                            prev[0] = avgX * factor + prev[0] * (1 - factor);
                            prev[1] = avgY * factor + prev[1] * (1 - factor);
                        }

                        newpts.push(prev);
                        newpts.push(sub);

                        prevsub = sub;
                    }

                    newpts.push(newpts[0]);
                    polygon.rings[0] = newpts;
                }

                return polygon;
            },

            _setupScene: function () {
                this.textures = {
                    noise: new THREE.TextureLoader().load("data:image/jpeg;base64," + noiseB64),
                    reflection: new THREE.TextureLoader().load("data:image/jpeg;base64," + reflectionB64)
                };

                this.textures.noise.wrapS = THREE.RepeatWrapping;
                this.textures.noise.wrapT = THREE.RepeatWrapping;

                this.textures.reflection.wrapS = THREE.RepeatWrapping;
                this.textures.reflection.wrapT = THREE.RepeatWrapping;

                this.waterMaterial = new THREE.ShaderMaterial({
                    vertexShader: waterGLVS,
                    fragmentShader: waterGLFS,

                    uniforms: {
                        noiseSampler: {
                            type: "t",
                            value: this.textures.noise
                        },

                        reflectionSampler: {
                            type: "t",
                            value: this.textures.reflection
                        },

                        origin: {
                            type: "v3",
                            value: new THREE.Vector3(this.geometry.origin[0], this.geometry.origin[1], this.geometry.origin[2])
                        },

                        eye: {
                            type: "v3",
                            value: new THREE.Vector3(0, 0, 0)
                        },

                        lightDirection: {
                            type: "v3",
                            value: new THREE.Vector3(0, 0, 0)
                        },

                        lightAmbient: {
                            type: "v4",
                            value: new THREE.Vector4(1, 1, 1, 1)
                        },

                        lightDiffuse: {
                            type: "v4",
                            value: new THREE.Vector4(1, 1, 1, 1)
                        },

                        phase: {
                            type: "f",
                            value: 0
                        },

                        scale: {
                            type: "f",
                            value: 0.2
                        },

                        color: {
                            type: "v3",
                            value: new THREE.Vector3(1, 1, 1)
                        },

                        enabled: {
                            type: "f",
                            value: 1
                        }
                    }
                });

                this.water = new THREE.Mesh(this.geometry.geometry, this.waterMaterial);

                this.scene.add(this.water);
            },

            render: function (context, renderer) {
                this._updateCamera(context);
                this._updateLights(context);

                this._updateMaterial();

                renderer.render(this.scene, this.camera);

                externalRenderers.requestRender(this.view);
            },

            _updateMaterial: function () {
                this.waterMaterial.uniforms.scale.value = this.waveSize * 2;
                this.waterMaterial.uniforms.phase.value += 1 / 60 * 0.1 * this.velocity;
                this.waterMaterial.uniforms.color.value.set(this.color[0], this.color[1], this.color[2]);
                this.waterMaterial.uniforms.enabled.value = this.enabled ? 1 : 0;
            },

            _updateLights: function (context) {
                var l = context.sunLight;

                this.waterMaterial.uniforms.lightDirection.value.set(l.direction[0], l.direction[1], l.direction[2]);
                this.waterMaterial.uniforms.lightAmbient.value.set(l.ambient.color[0], l.ambient.color[1], l.ambient.color[2], l.ambient.intensity);
                this.waterMaterial.uniforms.lightDiffuse.value.set(l.diffuse.color[0], l.diffuse.color[1], l.diffuse.color[2], l.diffuse.intensity);
            },

            _updateCamera: function (context) {
                var c = context.camera;

                this.camera.projectionMatrix.fromArray(c.projectionMatrix);

                var o = this.geometry.origin;

                this.camera.position.set(c.eye[0] - o[0], c.eye[1] - o[1], c.eye[2] - o[2]);
                this.camera.up.set(c.up[0], c.up[1], c.up[2]);
                this.camera.lookAt(new THREE.Vector3(c.center[0] - o[0], c.center[1] - o[1], c.center[2] - o[2]));

                this.waterMaterial.uniforms.eye.value.set(c.eye[0], c.eye[1], c.eye[2]);
            },

            _flattenRing: function (ring, elevationSampler) {
                var flattened = [];

                for (var i = 0; i < ring.length; i++) {
                    var pt = ring[i];

                    flattened.push(pt[0], pt[1]);

                    if (elevationSampler) {
                        flattened.push(elevationSampler(pt[0], pt[1]));
                    }
                }

                return flattened;
            },

            _tesselatePolygon: function (polygon, elevationSampler) {
                var ring = polygon.rings[0];
                var verts = this._flattenRing(ring, elevationSampler);

                var tessellated = earcut(verts, null, 3);
                var vertices = [];

                for (var i = 0; i < tessellated.length; i++) {
                    var idx = tessellated[i] * 3;
                    vertices.push(verts[idx], verts[idx + 1], verts[idx + 2]);
                }

                return {
                    polygon: polygon,
                    vertices: vertices
                };
            },

            _tesselatePolygonOnGrid: function (polygon, spacing, elevationSampler) {
                var extent = polygon.extent;

                var nx = Math.ceil(extent.width / spacing);
                var ny = Math.ceil(extent.height / spacing);

                var vertices = [];

                for (var y = 0; y < ny; y++) {
                    var y0 = extent.ymin + y * spacing;
                    var y1 = y0 + spacing;

                    for (var x = 0; x < nx; x++) {
                        var x0 = extent.xmin + x * spacing;
                        var x1 = x0 + spacing;

                        var corners = [
                            [x0, y0, elevationSampler(x0, y0)],
                            [x1, y0, elevationSampler(x1, y0)],
                            [x0, y1, elevationSampler(x0, y1)],
                            [x1, y1, elevationSampler(x1, y1)]
                        ];

                        var hasOutside = false;
                        var hasInside = false;

                        var i;

                        for (i = 0; i < corners.length; i++) {
                            if (polygon.contains(corners[i])) {
                                hasInside = true;
                            } else {
                                hasOutside = true;
                            }
                        }

                        var idx;

                        if (!hasOutside) {
                            // Completely inside, no need to tessellate
                            var indices = [0, 1, 2, 1, 3, 2];

                            for (i = 0; i < indices.length; i++) {
                                idx = indices[i];

                                vertices.push(corners[idx][0], corners[idx][1], corners[idx][2]);
                            }
                        } else if (hasInside) {
                            // Need to intersect, then run earcut
                            var intersected = geometryEngine.intersect(new Extent({
                                xmin: x0,
                                xmax: x1,
                                ymin: y0,
                                ymax: y1,
                                spatialReference: polygon.spatialReference
                            }), polygon);

                            if (intersected) {
                                var ring = intersected.rings[0];
                                var flatRing = [];

                                for (i = 0; i < ring.length; i++) {
                                    flatRing.push(ring[i][0], ring[i][1]);
                                }

                                var tessellated = earcut(flatRing);

                                for (i = 0; i < tessellated.length; i++) {
                                    idx = tessellated[i] * 2;
                                    vertices.push(flatRing[idx], flatRing[idx + 1], elevationSampler(flatRing[idx], flatRing[idx + 1]));
                                }
                            }
                        }
                    }
                }

                return {
                    polygon: polygon,
                    vertices: vertices
                };
            },

            _tesselateBufferedBorder: function (polygon, elevationSampler) {
                var buffered = this._subdivide(geometryEngine.buffer(polygon, 30), 0.5, 1);

                var inner = this._flattenRing(polygon.rings[0]);
                var outer = this._flattenRing(buffered.rings[0]);

                var innerZ = polygon.rings[0].map(function (pt) {
                    return elevationSampler(pt[0], pt[1]);
                });

                var verts = outer.concat(inner);
                var indices = earcut(verts, [outer.length / 2], 2);

                var vertices = [];
                var tmpPoint = new Point({
                    x: 0,
                    y: 0,
                    spatialReference: polygon.spatialReference
                });

                for (var i = 0; i < indices.length; i++) {
                    var idx = indices[i] * 2;
                    var z;

                    if (idx >= outer.length) {
                        z = innerZ[(idx - outer.length) / 2];
                    } else {
                        tmpPoint.x = verts[idx];
                        tmpPoint.y = verts[idx + 1];

                        var nearest = geometryEngine.nearestVertex(polygon, tmpPoint);
                        z = innerZ[nearest.vertexIndex] - 0.2;
                    }

                    vertices.push(verts[idx], verts[idx + 1], z);
                }

                return {
                    polygon: buffered,
                    vertices: vertices
                };
            },

            _originate: function (vertices) {
                var idx = Math.floor(vertices.length / 3 / 2) * 3;
                var origin = vertices.slice(idx, idx + 3);

                for (var i = 0; i < vertices.length; i += 3) {
                    vertices[i + 0] -= origin[0];
                    vertices[i + 1] -= origin[1];
                    vertices[i + 2] -= origin[2];
                }

                return origin;
            },

            _makeGeometry: function (vertices, extent) {
                var geometry = new THREE.BufferGeometry();

                // Project to render coordinates
                var position = externalRenderers.toRenderCoordinates(this.view, vertices, 0, null, new Array(vertices.length), 0, vertices.length / 3);

                // Choose local origin
                var origin = this._originate(position);

                geometry.addAttribute("position", new THREE.BufferAttribute(new Float32Array(position), 3));

                return {
                    geometry: geometry,
                    origin: origin
                };
            }
        });

        return WaterRenderer;
    });
