import arrayClean from 'd2-utilizr/lib/arrayClean';
import arrayPluck from 'd2-utilizr/lib/arrayPluck';

export default function LayerWidgetEvent(gis, layer) {

    // stores
    var programStore,
        stagesByProgramStore,
        dataElementsByStageStore,

    // cache
        stageStorage = {},
        attributeStorage = {},
        dataElementStorage = {},

    // components
        program,
        onProgramSelect,
        stage,
        onStageSelect,
        loadDataElements,
        dataElementAvailable,
        dataElementSelected,
        addUxFromDataElement,
        selectDataElements,
        dataElement,

        startDate,
        endDate,
        onDateFieldRender,
        periods,
        period,

        treePanel,
        userOrganisationUnit,
        userOrganisationUnitChildren,
        userOrganisationUnitGrandChildren,
        // organisationUnitLevel,
        // organisationUnitGroup,
        organisationUnitPanel,
        accordionBody,
        // toolMenu,
        // tool,
        // toolPanel,
        organisationUnit,
        eventColor,
        eventRadius,
        eventCluster,
        optionsPanel,

        panel,

    // functions
        reset,
        setGui,
        getView,
        validateView,

    // constants
        baseWidth = 444,

        accBaseWidth = baseWidth - 2,
        dimConf = gis.conf.finals.dimension;

    // stores

    programStore = Ext.create('Ext.data.Store', {
        fields: ['id', 'name'],
        proxy: {
            type: 'ajax',
            url: encodeURI(gis.init.contextPath + '/api/programs.json?fields=id,displayName|rename(name)&paging=false'),
            reader: {
                type: 'json',
                root: 'programs'
            },
            pageParam: false,
            startParam: false,
            limitParam: false
        },
        sortInfo: {field: 'name', direction: 'ASC'},
        isLoaded: false,
        listeners: {
            load: function() {
                if (!this.isLoaded) {
                    this.isLoaded = true;
                }
            }
        }
    });

    stagesByProgramStore = Ext.create('Ext.data.Store', {
        fields: ['id', 'name'],
        proxy: {
            type: 'ajax',
            url: '',
            reader: {
                type: 'json',
                root: 'programStages'
            }
        },
        isLoaded: false,
        loadFn: function(fn) {
            if (Ext.isFunction(fn)) {
                if (this.isLoaded) {
                    fn.call();
                }
                else {
                    this.load({
                        callback: fn
                    });
                }
            }
        },
        listeners: {
            load: function() {
                if (!this.isLoaded) {
                    this.isLoaded = true;
                }
                this.sort('name', 'ASC');
            }
        }
    });

    dataElementsByStageStore = Ext.create('Ext.data.Store', {
        fields: ['id', 'name', 'isAttribute'],
        data: [],
        sorters: [
            {
                property: 'isAttribute',
                direction: 'DESC'
            },
            {
                property: 'name',
                direction: 'ASC'
            }
        ]
    });

    // components

    // data element
    program = Ext.create('Ext.form.field.ComboBox', {
        fieldLabel: GIS.i18n.program,
        editable: false,
        valueField: 'id',
        displayField: 'name',
        labelAlign: 'top',
        labelCls: 'gis-form-item-label-top',
        labelSeparator: '',
        emptyText: GIS.i18n.select_program,
        forceSelection: true,
        queryMode: 'remote',
        columnWidth: 0.5,
        style: 'margin:1px 1px 1px 0',
        storage: {},
        store: programStore,
        getRecord: function() {
            return this.getValue ? {
                id: this.getValue(),
                name: this.getRawValue()
            } : null;
        },
        listeners: {
            select: function(cb) {
                onProgramSelect(cb.getValue());
            }
        }
    });

    onProgramSelect = function(programId, layout) {
        var load;

        programId = layout ? layout.program.id : programId;
        stage.clearValue();

        dataElementsByStageStore.removeAll();
        dataElementSelected.removeAll();

        load = function(stages) {
            stage.enable();
            stage.clearValue();

            stagesByProgramStore.removeAll();
            stagesByProgramStore.loadData(stages);

            //ns.app.aggregateLayoutWindow.resetData();
            //ns.app.queryLayoutWindow.resetData();

            var stageId = (layout ? layout.programStage.id : null) || (stages.length === 1 ? stages[0].id : null);

            if (stageId) {
                stage.setValue(stageId);
                onStageSelect(stageId, layout);
            }
        };

        if (stageStorage.hasOwnProperty(programId)) {
            load(stageStorage[programId]);
        }
        else {
            Ext.Ajax.request({
                url: encodeURI(gis.init.contextPath + '/api/programs.json?filter=id:eq:' + programId + '&fields=programStages[id,displayName|rename(name)],programTrackedEntityAttributes[trackedEntityAttribute[id,displayName|rename(name),valueType,optionSet[id,displayName|rename(name)]]]&paging=false'),
                success: function(r) {
                    var program = JSON.parse(r.responseText).programs[0],
                        stages,
                        attributes;

                    if (!program) {
                        return;
                    }

                    stages = program.programStages;
                    attributes = arrayPluck(program.programTrackedEntityAttributes, 'trackedEntityAttribute');

                    // mark as attribute
                    for (var i = 0; i < attributes.length; i++) {
                        attributes[i].isAttribute = true;
                    }

                    // attributes cache
                    if (Ext.isArray(attributes) && attributes.length) {
                        attributeStorage[programId] = attributes;
                    }

                    if (Ext.isArray(stages) && stages.length) {

                        // stages cache
                        stageStorage[programId] = stages;

                        load(stages);
                    }
                }
            });
        }
    };

    stage = Ext.create('Ext.form.field.ComboBox', {
        editable: false,
        valueField: 'id',
        displayField: 'name',
        fieldLabel: GIS.i18n.stage,
        labelAlign: 'top',
        labelCls: 'gis-form-item-label-top',
        labelSeparator: '',
        emptyText: GIS.i18n.select_stage,
        queryMode: 'local',
        forceSelection: true,
        columnWidth: 0.5,
        style: 'margin:1px 0 1px 0',
        disabled: true,
        listConfig: {loadMask: false},
        store: stagesByProgramStore,
        getRecord: function() {
            return this.getValue() ? {
                id: this.getValue(),
                name: this.getRawValue()
            } : null;
        },
        listeners: {
            select: function(cb) {
                onStageSelect(cb.getValue());
            }
        }
    });

    onStageSelect = function(stageId, layout) {
        if (!layout) {
            dataElementSelected.removeAll();
        }

        loadDataElements(stageId, layout);
    };

    loadDataElements = function(stageId, layout) {
        var programId = layout ? layout.program.id : (program.getValue() || null),
            load;

        stageId = stageId || layout.programStage.id;

        load = function(dataElements) {
            var attributes = attributeStorage[programId],
                data = arrayClean([].concat(attributes || [], dataElements || []));

            dataElementsByStageStore.loadData(data);

            if (layout) {
                var dataDimensions = gis.util.layout.getDataDimensionsFromLayout(layout),
                    records = [];

                for (var i = 0, dim, row; i < dataDimensions.length; i++) {
                    dim = dataDimensions[i];
                    row = dataElementsByStageStore.getById(dim.dimension);

                    if (row) {
                        records.push(Ext.applyIf(dim, row.data));
                    }
                }

                selectDataElements(records, layout);
            }
        };

        // data elements
        if (dataElementStorage.hasOwnProperty(stageId)) {
            load(dataElementStorage[stageId]);
        }
        else {
            Ext.Ajax.request({
                url: encodeURI(gis.init.contextPath + '/api/programStages.json?filter=id:eq:' + stageId + '&fields=programStageDataElements[dataElement[id,' + gis.init.namePropertyUrl + ',type,optionSet[id,displayName|rename(name)]]]'),
                success: function(r) {
                    var objects = JSON.parse(r.responseText).programStages,
                        dataElements;

                    if (!objects.length) {
                        load();
                        return;
                    }

                    dataElements = arrayPluck(objects[0].programStageDataElements, 'dataElement');

                    // data elements cache
                    dataElementStorage[stageId] = dataElements;

                    load(dataElements);
                }
            });
        }
    };

    dataElementAvailable = Ext.create('Ext.ux.form.MultiSelect', {
        cls: 'ns-toolbar-multiselect-left',
        width: accBaseWidth - 4,
        height: 118,
        valueField: 'id',
        displayField: 'name',
        style: 'margin-bottom:1px',
        store: dataElementsByStageStore,
        tbar: [
            {
                xtype: 'label',
                text: 'Available data items',
                cls: 'ns-toolbar-multiselect-left-label'
            },
            '->',
            {
                xtype: 'button',
                icon: 'images/arrowdown.png',
                width: 22,
                height: 22,
                handler: function() {
                    if (dataElementAvailable.getValue().length) {
                        selectDataElements(dataElementAvailable.getValue());
                    }
                }
            },
            {
                xtype: 'button',
                icon: 'images/arrowdowndouble.png',
                width: 22,
                height: 22,
                handler: function() {
                    if (dataElementsByStageStore.getRange().length) {
                        selectDataElements(dataElementsByStageStore.getRange());
                    }
                }
            }
        ],
        listeners: {
            afterrender: function(ms) {
                this.boundList.on('itemdblclick', function() {
                    if (ms.getValue().length) {
                        selectDataElements(ms.getValue());
                    }
                });
            }
        }
    });

    dataElementSelected = Ext.create('Ext.panel.Panel', {
        width: accBaseWidth - 4,
        height: 176,
        bodyStyle: 'padding-left:1px',
        autoScroll: true,
        tbar: {
            height: 27,
            items: [
                {
                    xtype: 'label',
                    text: 'Selected data items',
                    style: 'padding-left:6px; color:#222',
                    cls: 'ns-toolbar-multiselect-left-label'
                },
                '->',
                {
                    xtype: 'button',
                    icon: 'images/arrowupdouble.png',
                    width: 22,
                    height: 22,
                    handler: function() {
                        dataElementSelected.removeAllDataElements();
                    }
                }
            ]
        },
        getChildIndex: function(child) {
            var items = this.items.items;

            for (var i = 0; i < items.length; i++) {
                if (items[i].id === child.id) {
                    return i;
                }
            }

            return items.length;
        },
        hasDataElement: function(dataElementId) {
            var hasDataElement = false;

            this.items.each(function(item) {
                if (item.dataElement.id === dataElementId) {
                    hasDataElement = true;
                }
            });

            return hasDataElement;
        },
        removeAllDataElements: function() {
            var items = this.items.items,
                len = items.length;

            for (var i = 0; i < len; i++) {
                items[0].removeDataElement();
            }
        }
    });

    addUxFromDataElement = function(element, index) {
        var getUxType,
            ux;

        element.type = element.type || element.valueType;

        index = index || dataElementSelected.items.items.length;

        getUxType = function(element) {
            if (Ext.isObject(element.optionSet) && Ext.isString(element.optionSet.id)) {
                return 'Ext.ux.panel.OrganisationUnitGroupSetContainer';
            }

            if (element.type === 'int' || element.type === 'number') {
                return 'Ext.ux.panel.DataElementIntegerContainer';
            }

            if (element.type === 'string') {
                return 'Ext.ux.panel.DataElementStringContainer';
            }

            if (element.type === 'date') {
                return 'Ext.ux.panel.DataElementDateContainer';
            }

            if (element.type === 'bool' || element.type === 'trueOnly') {
                return 'Ext.ux.panel.DataElementBooleanContainer';
            }

            return 'Ext.ux.panel.DataElementIntegerContainer';
        };

        ux = dataElementSelected.insert(index, Ext.create(getUxType(element), {
            dataElement: element
        }));

        ux.removeDataElement = function() {
            dataElementSelected.remove(ux);

            if (!dataElementSelected.hasDataElement(element.id)) {
                dataElementsByStageStore.add(element);
                dataElementsByStageStore.sort();
            }
        };

        ux.duplicateDataElement = function() {
            var index = dataElementSelected.getChildIndex(ux) + 1;
            addUxFromDataElement(element, index);
        };

        dataElementsByStageStore.removeAt(dataElementsByStageStore.findExact('id', element.id));

        return ux;
    };

    selectDataElements = function(items, layout) {
        var dataElements = [];

        // data element objects
        for (var i = 0, item; i < items.length; i++) {
            item = items[i];

            if (Ext.isString(item)) {
                dataElements.push(dataElementsByStageStore.getAt(dataElementsByStageStore.findExact('id', item)).data);
            }
            else if (Ext.isObject(item)) {
                if (item.data) {
                    dataElements.push(item.data);
                }
                else {
                    dataElements.push(item);
                }
            }
        }

        // panel, store
        for (var i = 0, element, ux; i < dataElements.length; i++) {
            element = dataElements[i];

            ux = addUxFromDataElement(element);
            
            if (layout) {
                ux.setRecord(element);
            }
        }
    };

    dataElement = Ext.create('Ext.panel.Panel', {
        title: '<div class="gis-panel-title-data">' + GIS.i18n.data + '</div>',
        bodyStyle: 'padding:1px',
        hideCollapseTool: true,
        items: [
            {
                layout: 'column',
                bodyStyle: 'border:0 none',
                style: 'margin-top:2px',
                items: [
                    program,
                    stage
                ]
            },
            dataElementAvailable,
            dataElementSelected
        ]
    });

    // date

    onDateFieldRender = function(c) {
        $('#' + c.inputEl.id).calendarsPicker({
            calendar: gis.init.calendar,
            dateFormat: gis.init.systemInfo.dateFormat
        });

        Ext.get(c.id).setStyle('z-index', 100000);
    };

    startDate = Ext.create('Ext.form.field.Text', {
        fieldLabel: GIS.i18n.start_date,
        labelAlign: 'top',
        labelCls: 'gis-form-item-label-top',
        labelSeparator: '',
        columnWidth: 0.5,
        height: 41,
        value: gis.init.calendar.formatDate(gis.init.systemInfo.dateFormat, gis.init.calendar.today().add(-12, 'm')),
        listeners: {
            render: function(c) {
                onDateFieldRender(c);
            }
        }
    });

    endDate = Ext.create('Ext.form.field.Text', {
        fieldLabel: GIS.i18n.end_date,
        labelAlign: 'top',
        labelCls: 'gis-form-item-label-top',
        labelSeparator: '',
        columnWidth: 0.5,
        height: 41,
        style: 'margin-left: 1px',
        value: gis.init.calendar.formatDate(gis.init.systemInfo.dateFormat, gis.init.calendar.today()),
        listeners: {
            render: function(c) {
                onDateFieldRender(c);
            }
        }
    });

    // Relative periods
    periods = Ext.create('Ext.form.field.ComboBox', {
        cls: 'gis-combo',
        fieldLabel: GIS.i18n.period,
        labelSeparator: '',
        editable: false,
        valueField: 'id',
        displayField: 'name',
        queryMode: 'local',
        forceSelection: true,
        width: 220,
        labelWidth: gis.conf.layout.widget.itemlabel_width,
        labelAlign: 'top',
        labelCls: 'gis-form-item-label-top',
        style: 'padding-bottom:5px;',
        store: Ext.create('Ext.data.Store', {
            fields: ['id', 'name', 'index'],
            data: [{id: 'CUSTOM', name: GIS.i18n.start_end_dates}].concat(gis.conf.period.relativePeriods)
        }),
        selectFirst: function() {
            this.setValue(this.store.getAt(0).data.id);
        },
        listeners: {
            select: function () {
                var id = this.getValue();

                if (id === 'CUSTOM') {
                    startDate.enable();
                    endDate.enable();
                } else {
                    startDate.disable();
                    endDate.disable();
                }
            }
        }
    });

    period = Ext.create('Ext.panel.Panel', {
        title: '<div class="gis-panel-title-period">Periods</div>',
        bodyStyle: 'padding:4px 1px 2px',
        hideCollapseTool: true,
        width: accBaseWidth,
        items: [
            periods, {
                xtype: 'container',
                layout: 'column',
                items: [
                    startDate,
                    endDate
                ]
            }
        ]
    });

    // organisation unit
    treePanel = Ext.create('Ext.tree.Panel', {
        cls: 'gis-tree',
        width: accBaseWidth - 4,
        height: 313,
        bodyStyle: 'border:0 none',
        style: 'border-top: 1px solid #ddd; padding-top: 1px;',
        displayField: 'name',
        rootVisible: false,
        autoScroll: false, // https://www.sencha.com/forum/archive/index.php/t-144780.html?s=b3a72bbd82e5cc20417f0b5779439b97
        scroll:false,
        viewConfig: {
            style: 'overflow-y:auto'
        },
        multiSelect: true,
        rendered: false,
        reset: function() {
            var rootNode = this.getRootNode().findChild('id', gis.init.rootNodes[0].id);
            this.collapseAll();
            this.expandPath(rootNode.getPath());
            this.getSelectionModel().select(rootNode);
        },
        selectRootIf: function() {
            if (this.getSelectionModel().getSelection().length < 1) {
                var node = this.getRootNode().findChild('id', gis.init.rootNodes[0].id);
                if (this.rendered) {
                    this.getSelectionModel().select(node);
                }
                return node;
            }
        },
        isPending: false,
        recordsToSelect: [],
        recordsToRestore: [],
        multipleSelectIf: function(map, doUpdate) {
            if (this.recordsToSelect.length === gis.util.object.getLength(map)) {
                this.getSelectionModel().select(this.recordsToSelect);
                this.recordsToSelect = [];
                this.isPending = false;

                if (doUpdate) {
                    update();
                }
            }
        },
        multipleExpand: function(id, map, doUpdate) {
            var that = this,
                rootId = gis.conf.finals.root.id,
                path = map[id];

            if (path.substr(0, rootId.length + 1) !== ('/' + rootId)) {
                path = '/' + rootId + path;
            }

            that.expandPath(path, 'id', '/', function() {
                var record = Ext.clone(that.getRootNode().findChild('id', id, true));
                that.recordsToSelect.push(record);
                that.multipleSelectIf(map, doUpdate);
            });
        },
        select: function(url, params) {
            if (!params) {
                params = {};
            }
            Ext.Ajax.request({
                url: encodeURI(url),
                method: 'GET',
                params: params,
                scope: this,
                success: function(r) {
                    var a = JSON.parse(r.responseText).organisationUnits;
                    this.numberOfRecords = a.length;
                    for (var i = 0; i < a.length; i++) {
                        this.multipleExpand(a[i].id, a[i].path);
                    }
                }
            });
        },
        getParentGraphMap: function() {
            var selection = this.getSelectionModel().getSelection(),
                map = {};

            if (Ext.isArray(selection) && selection.length) {
                for (var i = 0, pathArray; i < selection.length; i++) {
                    pathArray = selection[i].getPath().split('/');
                    map[pathArray.pop()] = pathArray.join('/');
                }
            }

            return map;
        },
        selectGraphMap: function(map, update) {
            if (!gis.util.object.getLength(map)) {
                return;
            }

            this.isPending = true;

            for (var key in map) {
                if (map.hasOwnProperty(key)) {
                    treePanel.multipleExpand(key, map, update);
                }
            }
        },
        store: Ext.create('Ext.data.TreeStore', {
            fields: ['id', 'name', 'hasChildren'],
            proxy: {
                type: 'rest',
                format: 'json',
                noCache: false,
                extraParams: {
                    fields: 'children[id,' + gis.init.namePropertyUrl + ',children::isNotEmpty|rename(hasChildren)&paging=false'
                },
                url: gis.init.contextPath + '/api/organisationUnits',
                reader: {
                    type: 'json',
                    root: 'children'
                },
                sortParam: false
            },
            sorters: [{
                property: 'name',
                direction: 'ASC'
            }],
            root: {
                id: gis.conf.finals.root.id,
                expanded: true,
                children: gis.init.rootNodes
            },
            listeners: {
                beforeload: function(store, operation) {
                    if (!store.proxy._url) {
                        store.proxy._url = store.proxy.url;
                    }
                    
                    store.proxy.url = store.proxy._url + '/' + operation.node.data.id;
                },
                load: function(store, node, records) {
                    records.forEach(function(record) {
                        if (Ext.isBoolean(record.data.hasChildren)) {
                            record.set('leaf', !record.data.hasChildren);
                        }
                    });
                }
            }
        }),
        xable: function(values) {
            for (var i = 0; i < values.length; i++) {
                if (!!values[i]) {
                    this.disable();
                    return;
                }
            }

            this.enable();
        },
        getDimension: function() {
            var r = treePanel.getSelectionModel().getSelection(),
                config = {
                    dimension: gis.conf.finals.dimension.organisationUnit.objectName,
                    items: []
                };

            if (userOrganisationUnit.getValue() || userOrganisationUnitChildren.getValue() || userOrganisationUnitGrandChildren.getValue()) {
                if (userOrganisationUnit.getValue()) {
                    config.items.push({
                        id: 'USER_ORGUNIT',
                        name: ''
                    });
                }
                if (userOrganisationUnitChildren.getValue()) {
                    config.items.push({
                        id: 'USER_ORGUNIT_CHILDREN',
                        name: ''
                    });
                }
                if (userOrganisationUnitGrandChildren.getValue()) {
                    config.items.push({
                        id: 'USER_ORGUNIT_GRANDCHILDREN',
                        name: ''
                    });
                }
            }
            else {
                for (var i = 0; i < r.length; i++) {
                    config.items.push({id: r[i].data.id});
                }
            }

            return config.items.length ? config : null;
        },
        listeners: {
            beforeitemexpand: function() {
                if (!treePanel.isPending) {
                    treePanel.recordsToRestore = treePanel.getSelectionModel().getSelection();
                }
            },
            itemexpand: function() {
                if (!treePanel.isPending && treePanel.recordsToRestore.length) {
                    treePanel.getSelectionModel().select(treePanel.recordsToRestore);
                    treePanel.recordsToRestore = [];
                }
            },
            render: function() {
                this.rendered = true;
            },
            afterrender: function() {
                this.getSelectionModel().select(0);
            },
            itemcontextmenu: function(v, r, h, i, e) {
                e.stopEvent();

                v.getSelectionModel().select(r, false);

                if (v.menu) {
                    v.menu.destroy();
                }
                v.menu = Ext.create('Ext.menu.Menu', {
                    showSeparator: false,
                    shadow: false
                });
                if (!r.data.leaf) {
                    v.menu.add({
                        text: GIS.i18n.select_sub_units,
                        icon: 'images/node-select-child.png',
                        handler: function() {
                            r.expand(false, function() {
                                v.getSelectionModel().select(r.childNodes, true);
                                v.getSelectionModel().deselect(r);
                            });
                        }
                    });
                }
                else {
                    return;
                }

                v.menu.showAt(e.xy);
            }
        }
    });

    userOrganisationUnit = Ext.create('Ext.form.field.Checkbox', {
        columnWidth: 0.33, // 0.25,
        style: 'padding-top: 2px; padding-left: 5px; margin-bottom: 0',
        boxLabelCls: 'x-form-cb-label-alt1',
        boxLabel: GIS.i18n.user_organisation_unit,
        labelWidth: gis.conf.layout.form_label_width,
        handler: function(chb, checked) {
            treePanel.xable([checked, userOrganisationUnitChildren.getValue(), userOrganisationUnitGrandChildren.getValue()]);
        }
    });

    userOrganisationUnitChildren = Ext.create('Ext.form.field.Checkbox', {
        columnWidth: 0.33, // 0.26,
        style: 'padding-top: 2px; margin-bottom: 0',
        boxLabelCls: 'x-form-cb-label-alt1',
        boxLabel: GIS.i18n.user_sub_units,
        labelWidth: gis.conf.layout.form_label_width,
        handler: function(chb, checked) {
            treePanel.xable([checked, userOrganisationUnit.getValue(), userOrganisationUnitGrandChildren.getValue()]);
        }
    });

    userOrganisationUnitGrandChildren = Ext.create('Ext.form.field.Checkbox', {
        columnWidth: 0.33, //0.4,
        style: 'padding-top: 2px; margin-bottom: 0',
        boxLabelCls: 'x-form-cb-label-alt1',
        boxLabel: GIS.i18n.user_sub_x2_units,
        labelWidth: gis.conf.layout.form_label_width,
        handler: function(chb, checked) {
            treePanel.xable([checked, userOrganisationUnit.getValue(), userOrganisationUnitChildren.getValue()]);
        }
    });

    organisationUnitPanel = Ext.create('Ext.panel.Panel', {
        width: accBaseWidth,
        layout: 'column',
        bodyStyle: 'border:0 none',
        items: [
            userOrganisationUnit,
            userOrganisationUnitChildren,
            userOrganisationUnitGrandChildren
        ]
    });

    organisationUnit = Ext.create('Ext.panel.Panel', {
        title: '<div class="gis-panel-title-organisationunit">' + GIS.i18n.organisation_units + '</div>',
        bodyStyle: 'padding:1px',
        hideCollapseTool: true,
        items: [
            organisationUnitPanel,
            treePanel
        ]
    });

    eventColor = Ext.create('Ext.ux.button.ColorButton', {
        xtype: 'colorbutton',
        height: 24,
        width: 80,
        value: '333333'
    });

    eventRadius = Ext.create('Ext.form.field.Number', {
        cls: 'gis-numberfield',
        width: 80,
        allowDecimals: false,
        minValue: 1,
        maxValue: 20,
        value: 6
    });

    eventCluster = Ext.create('Ext.form.field.Checkbox', {
        boxLabel: 'Group nearby events',
        cls: 'gis-event-clustering-checkbox',
        checked: true
    });

    optionsPanel = Ext.create('Ext.panel.Panel', {
        title: '<div class="gis-panel-title-options">' + GIS.i18n.options + '</div>',
        cls: 'gis-accordion-last',
        bodyStyle: 'padding:6px 8px;',
        hideCollapseTool: true,
        width: accBaseWidth,
        items: [
            {
                xtype: 'container',
                html: 'Clustering',
                style: 'padding-bottom:3px;font-weight:bold;font-size:12px;'
            },
            eventCluster,
            {
                xtype: 'container',
                html: 'Style',
                style: 'padding:10px 0 3px;font-weight:bold;font-size:12px;'
            },
            {
                xtype: 'container',
                layout: 'hbox',
                items: [
                    {
                        xtype: 'container',
                        html: 'Point color:',
                        width: 80,
                        style: 'padding:5px;font-size:11px;'
                    },
                    eventColor
                ]
            },
            {
                xtype: 'container',
                layout: 'hbox',
                items: [
                    {
                        xtype: 'container',
                        html: 'Point radius:',
                        width: 80,
                        style: 'padding:5px;font-size:11px;'
                    },
                    eventRadius
                ]
            }
        ]
    });

    // accordion
    accordionBody = Ext.create('Ext.panel.Panel', {
        layout: 'accordion',
        activeOnTop: true,
        cls: 'gis-accordion',
        bodyStyle: 'border:0 none',
        height: 450,
        items: [
            dataElement,
            period,
            organisationUnit,
            optionsPanel
        ],
        listeners: {
            afterrender: function() { // nasty workaround
                optionsPanel.expand();
                organisationUnit.expand();
                period.expand();
                dataElement.expand();
                periods.selectFirst();
            }
        }
    });

    // functions

    reset = function(skipTree) {

        // Uncheck in layers list
        layer.item.setValue(false);

        if (!layer.window.isRendered) {
            layer.view = null;
            return;
        }

        // Components
        program.clearValue();
        stage.clearValue();

        dataElementsByStageStore.removeAll();
        dataElementSelected.removeAll();

        periods.selectFirst();
        startDate.reset();
        endDate.reset();

        if (!skipTree) {
            treePanel.reset();
        }

        userOrganisationUnit.setValue(false);
        userOrganisationUnitChildren.setValue(false);
        userOrganisationUnitGrandChildren.setValue(false);
    };

    setGui = function(view) {
        var ouDim = view.rows[0],
            isOu = false,
            isOuc = false,
            isOugc = false,
            isTopOu = false,
            setWidgetGui,
            setLayerGui;

        setWidgetGui = function() {

            // Components
            if (!layer.window.isRendered) {
                return;
            }

            reset(true);

            // Program
            program.store.add(view.program);
            program.setValue(view.program.id);

            onProgramSelect(null, view);

            if (view.startDate) {
                startDate.setValue(view.startDate);
                startDate.enable();
            }

            if (view.endDate) {
                endDate.setValue(view.endDate);
                endDate.enable();
            }

            // Periods
            if (view.filters && view.filters[0] && view.filters[0].dimension === dimConf.period.objectName && view.filters[0].items) {
                periods.select(view.filters[0].items[0].id);
                startDate.disable();
                endDate.disable();
            }

            // Organisation units
            for (var i = 0, item; i < ouDim.items.length; i++) {
                item = ouDim.items[i];

                if (item.id === 'USER_ORGUNIT') {
                    isOu = true;
                }
                else if (item.id === 'USER_ORGUNIT_CHILDREN') {
                    isOuc = true;
                }
                else if (item.id === 'USER_ORGUNIT_GRANDCHILDREN') {
                    isOugc = true;
                } else {
                    isTopOu = true;
                }
            }

            if (!isTopOu) {
                userOrganisationUnit.setValue(isOu);
                userOrganisationUnitChildren.setValue(isOuc);
                userOrganisationUnitGrandChildren.setValue(isOugc);
            }

            treePanel.selectGraphMap(view.parentGraphMap);

            // Options
            if (view.eventClustering !== undefined) {
                eventCluster.setValue(view.eventClustering);
            }

            if (view.eventPointColor) {
                eventColor.setValue(view.eventPointColor);
            }

            if (view.eventPointRadius !== undefined) {
                eventRadius.setValue(view.eventPointRadius);
            }

        }();

        setLayerGui = function() {

            // Layer item
            layer.item.setValue(!view.hidden, view.opacity);

            // Layer menu
            layer.menu.enableItems();
        }();
    };

    getView = function(config) {
        var view = {};

        view.program = program.getRecord();
        view.programStage = stage.getRecord();

        if (periods.getValue() === 'CUSTOM') {
            view.startDate = startDate.getValue();
            view.endDate = endDate.getValue();
        } else {
            // pe
            view.filters = [{
                dimension: dimConf.period.objectName,
                items: [{
                    id: periods.getValue()
                }]
            }];
        }

        view.columns = [];

        for (var i = 0, panel; i < dataElementSelected.items.items.length; i++) {
            panel = dataElementSelected.items.items[i];
            view.columns.push(panel.getRecord());
        }

        view.rows = [{
            dimension: 'ou',
            items: treePanel.getDimension().items
        }];

        view.eventClustering = eventCluster.getValue();
        view.eventPointColor = eventColor.getValue();
        view.eventPointRadius = eventRadius.getValue();
        view.opacity = layer.layerOpacity;

        return view;
    };

    validateView = function(view) {
        if (!(Ext.isArray(view.rows) && view.rows.length && Ext.isString(view.rows[0].dimension) && Ext.isArray(view.rows[0].items) && view.rows[0].items.length)) {
            GIS.logg.push([view.rows, layer.id + '.rows: dimension array']);
            alert('No organisation units selected');
            return false;
        }

        return view;
    };

    panel = Ext.create('Ext.panel.Panel', {
        map: layer.map,
        layer: layer,
        menu: layer.menu,

        reset: reset,
        setGui: setGui,
        getView: getView,
        getParentGraphMap: function() {
            return treePanel.getParentGraphMap();
        },

        cls: 'gis-form-widget',
        border: false,
        items: [
            accordionBody
        ]
    });

    return panel;
};
