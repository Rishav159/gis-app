import isArray from 'd2-utilizr/lib/isArray';
import isObject from 'd2-utilizr/lib/isObject';
import arrayDifference from 'd2-utilizr/lib/arrayDifference';
import arrayUnique from 'd2-utilizr/lib/arrayUnique';

export default function LayerHandlerBoundary(gis, layer) {
    var compareView,
        loadOrganisationUnits,
        loadData,
        afterLoad,
        loader,
        contextMenu,
        onFeatureClick,
        onFeatureRightClick,
        onMapClick;

    compareView = function(view, doExecute) {
        var src = layer.view,
            viewIds,
            viewDim,
            srcIds,
            srcDim;

        if (!src) {
            if (doExecute) {
                loadOrganisationUnits(view);
            }
            return gis.conf.finals.widget.loadtype_organisationunit;
        }

        viewIds = [];
        viewDim = view.rows[0];
        srcIds = [];
        srcDim = src.rows[0];

        // organisation units
        if (viewDim.items.length === srcDim.items.length) {
            for (var i = 0; i < viewDim.items.length; i++) {
                viewIds.push(viewDim.items[i].id);
            }

            for (var i = 0; i < srcDim.items.length; i++) {
                srcIds.push(srcDim.items[i].id);
            }

            if (arrayDifference(viewIds, srcIds).length !== 0) {
                if (doExecute) {
                    loadOrganisationUnits(view);
                }
                return gis.conf.finals.widget.loadtype_organisationunit;
            }

            if (doExecute) {
                loader.zoomToVisibleExtent = false;
                loadData(view);
            }

            return gis.conf.finals.widget.loadtype_legend;
        }
        else {
            if (doExecute) {
                loadOrganisationUnits(view);
            }
            return gis.conf.finals.widget.loadtype_organisationunit;
        }
    };

    loadOrganisationUnits = function(view) {
        var items = view.rows[0].items,
            propertyMap = {
                'name': 'name',
                'displayName': 'name',
                'shortName': 'shortName',
                'displayShortName': 'shortName'
            },
            keyAnalysisDisplayProperty = gis.init.userAccount.settings.keyAnalysisDisplayProperty,
            displayProperty = propertyMap[keyAnalysisDisplayProperty] || propertyMap[xLayout.displayProperty] || 'name',
            url = function() {
                var params = '?ou=ou:';

                for (var i = 0; i < items.length; i++) {
                    params += items[i].id;
                    params += i !== items.length - 1 ? ';' : '';
                }

                params += '&displayProperty=' + displayProperty.toUpperCase();

                if (isArray(view.userOrgUnit) && view.userOrgUnit.length) {
                    params += '&userOrgUnit=';

                    for (var i = 0; i < view.userOrgUnit.length; i++) {
                        params += view.userOrgUnit[i] + (i < view.userOrgUnit.length - 1 ? ';' : '');
                    }
                }

                return gis.init.apiPath + 'geoFeatures.json' + params;
            }(),
            success,
            failure;

        success = function(r) {
            var features = gis.util.geojson.decode(r, 'ASC'),
                colors = ['black', 'blue', 'red', 'green', 'yellow'],
                weights = [2, 1, 0.75, 0.5, 0.5],
                levels = [],
                levelStyle = {};

            if (!r.length) {
                gis.mask.hide();
                gis.alert(GIS.i18n.no_valid_coordinates_found);
                return;
            }

            for (var i = 0; i < r.length; i++) {
                levels.push(parseInt(r[i].le));
            }

            levels = arrayUnique(levels).sort();

            for (var i = 0; i < levels.length; i++) {
                levelStyle[levels[i]] = {
                    color: colors[i],
                    weight: (levels.length === 1 ? 1 : weights[i])
                };
            }

            // Apply feature styles
            for (var i = 0, feature; i < features.length; i++) {
                feature = features[i];
                feature.properties.style = levelStyle[feature.properties.level];
                feature.properties.labelStyle = {
                    paddingTop: (feature.geometry.type === 'Point' ? '15px' : '0')
                };
            }

            // Store features for search
            layer.featureStore.loadFeatures(features.slice(0));
            layer.features = features;

            loadData(view, features);
        };

        failure = function() {
            if (gis.mask) {
                gis.mask.hide();
            }
            gis.alert(GIS.i18n.coordinates_could_not_be_loaded);
        };

        Ext.Ajax.request({
            url: encodeURI(url),
            disableCaching: false,
            success: function(r) {
                success(JSON.parse(r.responseText));
            },
            failure: function() {
                failure();
            }
        });
    };

    loadData = function(view, features) {
        var layerConfig = Ext.applyIf({
            data: features || layer.features,
            hoverLabel: '{name}',
        }, layer.config);

        if (view.labels) {
            Ext.apply(layerConfig, {
                label: '{name}',
                labelStyle: {
                    fontSize: view.labelFontSize,
                    fontStyle: view.labelFontStyle
                }
            });
        }

        // Remove layer instance if already exist
        if (layer.instance && gis.instance.hasLayer(layer.instance)) {
            layer.instance.off('click', onFeatureClick);
            layer.instance.off('contextmenu', onFeatureRightClick);
            gis.instance.off('click', onMapClick);
            gis.instance.removeLayer(layer.instance);
        }

        // Create layer instance
        layer.instance = gis.instance.addLayer(layerConfig);

        layer.instance.on('click', onFeatureClick);
        layer.instance.on('contextmenu', onFeatureRightClick);

        gis.instance.on('click', onMapClick);

        layer.view = view;

        afterLoad(view);
    };

    onFeatureClick = function(evt) {
        GIS.core.FeaturePopup(gis, evt.layer);
    };

    onFeatureRightClick = function(evt) {
        L.DomEvent.stopPropagation(evt); // Don't propagate to map right-click
        contextMenu = GIS.core.ContextMenu(gis, layer, evt.layer, evt.latlng);
        contextMenu.showAt([evt.originalEvent.x, evt.originalEvent.pageY || evt.originalEvent.y]);
    };

    // Remove context menu on map click
    onMapClick = function() {
        if (contextMenu) {
            contextMenu.destroy();
        }
        contextMenu = null;
    };

    afterLoad = function(view) {

        // Layer
        if (layer.item) { // Layer stack
            layer.item.setValue(true, view.opacity);
        }
        else {
            layer.instance.setOpacity(view.opacity);
        }

        // Gui
        if (loader.updateGui && isObject(layer.widget)) {
            layer.widget.setGui(view);
        }

        // Zoom
        if (loader.zoomToVisibleExtent) {
            gis.instance.fitBounds(layer.instance.getBounds());
        }

        // Mask
        if (loader.hideMask) {
            gis.mask.hide();
        }

        // Map callback
        if (loader.callBack) {
            loader.callBack(layer);
        }
        else {
            gis.map = null;

            if (gis.viewport.shareButton) {
                gis.viewport.shareButton.enable();
            }
        }

        // mouse events
        if (layer.unregisterMouseDownEvent) {
            layer.unregisterMouseDownEvent();
        }

    };

    loader = {
        compare: false,
        updateGui: false,
        zoomToVisibleExtent: false,
        hideMask: false,
        callBack: null,
        load: function(view) {
            if (gis.mask && !gis.skipMask) {
                gis.mask.show();
            }

            if (this.compare) {
                compareView(view, true);
            }
            else {
                loadOrganisationUnits(view);
            }
        },
        loadData: loadData
    };

    return loader;
};
