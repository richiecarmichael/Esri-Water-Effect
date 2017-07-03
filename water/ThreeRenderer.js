define([
    "esri/core/declare",
    "esri/core/watchUtils",
    "esri/views/3d/externalRenderers"
], function (
    declare,
    watchUtils,
    externalRenderers
) {
        var THREE = window.THREE;
        var THREERenderer = declare([], {
            constructor: function (view, renderers) {
                this.renderers = (renderers || []).slice();

                this.view = view;
                externalRenderers.add(this.view, this);
            },

            destroy: function () {
                externalRenderers.remove(this.view, this);
                this.view = null;
            },

            add: function (renderer) {
                this.renderers.push(renderer);

                if (this.renderer) {
                    renderer.setup();
                }
            },

            setup: function (context) {
                this.renderer = new THREE.WebGLRenderer({
                    context: context.gl
                });

                this.renderer.autoClear = false;
                this.renderer.autoClearDepth = false;
                this.renderer.autoClearColor = false;
                this.renderer.autoClearStencil = false;

                this._watchHandle = watchUtils.init(this.view, "size", function (size) {
                    this.renderer.setSize(size[0], size[1]);
                }.bind(this));

                this.renderers.forEach(function (renderer) {
                    renderer.setup();
                });
            },

            dispose: function (context) {
                if (this._watchHandle) {
                    this._watchHandle.remove();
                    this._watchHandle = null;
                }

                this.renderers.forEach(function (renderer) {
                    if (renderer.dispose) {
                        renderer.dispose(context, this.renderer);
                    }
                });
            },

            render: function (context) {
                this.renderer.resetGLState();

                this.renderers.forEach(function (renderer) {
                    if (renderer.render) {
                        renderer.render(context, this.renderer);
                    }
                }.bind(this));

                externalRenderers.requestRender(this.view);
            }
        });

        return THREERenderer;
    }
);
