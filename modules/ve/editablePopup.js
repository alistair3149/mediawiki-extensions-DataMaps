/** @typedef {import( './editor.js' )} MapVisualEditor */
const { DataMap, MarkerPopup, Util, MapFlags } = require( 'ext.datamaps.core' ),
    { createDomElement } = Util,
    MarkerDataService = require( './data/markerService.js' ),
    CreateMarkerWorkflow = require( './workflow/createMarker.js' ),
    DataEditorUiBuilder = require( './data/editor.js' ),
    DataCapsule = require( './dataCapsule.js' );


class EditableMarkerPopup extends MarkerPopup {
    /**
     * @param {InstanceType< DataMap >} map
     * @param {LeafletModule.AnyMarker} leafletMarker
     */
    constructor( map, leafletMarker ) {
        super( map, leafletMarker );

        /**
         * @private
         * @type {MapVisualEditor}
         */
        this._editor = this.slots.editor;
        /**
         * @private
         * @type {MarkerDataService}
         */
        this._dataService = this._editor.getService( MarkerDataService );
        /**
         * @private
         * @type {import( '../../schemas/src/index' ).Marker}
         */
        this._source = this._dataService.getLeafletMarkerSource( this.leafletMarker );
        /**
         * @private
         * @type {mw.Api}
         */
        this._mwApi = new mw.Api();
    }


    shouldKeepAround() {
        return false;
    }


    /**
     * Builds the buttons.
     *
     * @param {HTMLElement} element
     */
    buildButtons( element ) {
        createDomElement( 'a', {
            classes: [ 'ext-datamaps-popup-ve-edit', 'oo-ui-icon-edit' ],
            attributes: {
                role: 'button',
                href: '#',
                title: mw.msg( 'datamap-ve-panel-marker-edit' )
            },
            events: {
                click: event => {
                    event.preventDefault();
                    // TODO: refactor into EditableMarkerPopup.Dialog.open( { ... } )
                    this._editor.windowManager.openWindow( 'mve-edit-marker', {
                        target: this.leafletMarker
                    } );
                }
            },
            appendTo: element
        } );
        createDomElement( 'a', {
            classes: [ 'ext-datamaps-popup-ve-delete', 'oo-ui-icon-trash' ],
            attributes: {
                role: 'button',
                href: '#',
                title: mw.msg( 'datamap-ve-panel-marker-delete' )
            },
            events: {
                click: event => {
                    event.preventDefault();
                    this._dataService.remove( this.leafletMarker );
                }
            },
            appendTo: element
        } );
    }


    /**
     * @param {HTMLElement} element
     */
    buildHeader( element ) {
        // Build the title
        if ( this.slots.label && this.markerGroup.name !== this.slots.label ) {
            this.subTitle = createDomElement( 'b', {
                classes: [ 'ext-datamaps-popup-subtitle' ],
                text: this.markerGroup.name,
                appendTo: element
            } );
            this.title = createDomElement( 'b', {
                classes: [ 'ext-datamaps-popup-title' ],
                appendTo: element
            } );
        } else {
            this.title = createDomElement( 'b', {
                classes: [ 'ext-datamaps-popup-title' ],
                text: this.markerGroup.name,
                appendTo: element
            } );
        }

        // Collect layer discriminators
        const /** @type {string[]} */ discrims = [];
        this.leafletMarker.attachedLayers.forEach( ( layerId, index ) => {
            const layer = this.map.config.layers[ layerId ];
            if ( index > 0 && layer && layer.discrim ) {
                discrims.push( layer.discrim );
            }
        } );

        // Gather detail text from layers
        let detailText = discrims.join( ', ' );
        // Reformat if coordinates are to be shown
        if ( this.map.isFeatureBitSet( MapFlags.ShowCoordinates ) ) {
            const coordText = this.map.getCoordinateLabel( this.leafletMarker.apiInstance );
            detailText = detailText ? `${coordText} (${detailText})` : coordText;
        }
        // Push onto the contents
        this.location = createDomElement( 'div', {
            classes: [ 'ext-datamaps-popup-location' ],
            text: detailText,
            appendTo: element
        } );
    }


    /**
     * Builds contents of this popup.
     *
     * @param {HTMLElement} element
     */
    buildContent( element ) {
        // Description
        if ( this.slots.desc ) {
            this.description = createDomElement( 'div', {
                classes: [ 'ext-datamaps-popup-description' ],
                appendTo: element
            } );
        }

        // Image
        if ( this.slots.imageName ) {
            this.image = createDomElement( 'img', {
                classes: [ 'ext-datamaps-popup-image' ],
                attributes: {
                    width: 250
                },
                appendTo: element
            } );
        }
    }


    /**
     * Builds the action list of this popup.
     *
     * @param {HTMLElement} element
     */
    buildActions( element ) {
    }


    onAdd() {
        // TODO: handle errors
        if ( this.title && this.slots.label ) {
            // eslint-disable-next-line mediawiki/class-doc
            this.title.classList.add( EditableMarkerPopup.SKELETON_CLASS );
            this._parseWikitext( this.slots.label ).then( parsed => {
                if ( this.title ) {
                    this.title.innerHTML = parsed.slice( 3, -4 );
                    // eslint-disable-next-line mediawiki/class-doc
                    this.title.classList.remove( EditableMarkerPopup.SKELETON_CLASS );
                }
            } );
        }

        if ( this.description && this.slots.desc ) {
            // eslint-disable-next-line mediawiki/class-doc
            this.description.classList.add( EditableMarkerPopup.SKELETON_CLASS );
            this._parseWikitext( this.slots.desc ).then( parsed => {
                if ( this.description ) {
                    this.description.innerHTML = parsed;
                    // eslint-disable-next-line mediawiki/class-doc
                    this.description.classList.remove( EditableMarkerPopup.SKELETON_CLASS );
                }
            } );
        }

        if ( this.image && this.slots.imageName ) {
            // eslint-disable-next-line mediawiki/class-doc
            this.image.classList.add( EditableMarkerPopup.SKELETON_CLASS );
            this._mwApi.get( {
                action: 'query',
                prop: 'imageinfo',
                titles: `File:${this.slots.imageName}`,
                iiurlwidth: this.image.clientWidth,
                iiprop: [ 'url' ]
            } ).then( response => {
                if ( this.image ) {
                    const info = Object.values( response.query.pages )[ 0 ].imageinfo[ 0 ];
                    this.image.setAttribute( 'height', info.thumbheight );
                    this.image.setAttribute( 'data-file-width', info.width );
                    this.image.setAttribute( 'data-file-height', info.height );
                    this.image.setAttribute( 'src', info.thumburl );
                    // eslint-disable-next-line mediawiki/class-doc
                    this.image.classList.remove( EditableMarkerPopup.SKELETON_CLASS );
                }
            } );
        }
    }


    /**
     * @private
     * @param {string} wikitext
     * @return {JQuery.Promise<string, any, any>}
     */
    _parseWikitext( wikitext ) {
        return this._mwApi.parse( wikitext, {
            title: this._editor.getPageName(),
            disablelimitreport: true,
            disabletoc: true,
            contentmodel: 'wikitext',
            wrapoutputclass: ''
        } );
    }


    onRemove() { }
}


/**
 * @constant
 * @type {string}
 */
EditableMarkerPopup.SKELETON_CLASS = 'ext-datamaps-ve-load-rect';


/**
 * @typedef {Object} EditMarkerDialogData
 * @property {LeafletModule.AnyMarker} target
 */


/**
 * @extends {CreateMarkerWorkflow.BaseMarkerDialog<EditMarkerDialogData>}
 */
EditableMarkerPopup.Dialog = class EditMarkerDialogController extends CreateMarkerWorkflow.BaseMarkerDialog {
    /**
     * @param {MapVisualEditor} editor
     * @param {string} messageKey
     * @param {OO.ui.ProcessDialog} dialog
     * @param {EditMarkerDialogData} contextData
     */
    constructor( editor, messageKey, dialog, contextData ) {
        super( editor, messageKey, dialog, contextData );

        /**
         * @private
         * @type {LeafletModule.AnyMarker}
         */
        this._leafletMarker = contextData.target;
        /**
         * @private
         * @type {import( '../../schemas/src/index.js' ).Marker}
         */
        this._finalTarget = this._dataService.getLeafletMarkerSource( this._leafletMarker );
        /**
         * @private
         * @type {import( '../../schemas/src/index.js' ).Marker}
         */
        this._workingTarget = Object.assign( {}, this._finalTarget );

        this._leafletMarker.closePopup();
    }


    /**
     * @return {string}
     */
    static getSubmitButtonMessageKey() {
        return 'edit';
    }


    getTargetObject() {
        return this._workingTarget;
    }


    /**
     * @param {'save'} action
     * @return {OO.ui.Process?}
     */
    getActionProcess( action ) {
        if ( action === 'save' ) {
            return new OO.ui.Process( () => {
                let leafletMarker = this._leafletMarker;
                // Merge state and update
                Object.assign( this._finalTarget, this._workingTarget );
                this._dataService.syncRuntime( this._leafletMarker );
                // Move between groups if needed
                const targetGroup = Util.getNonNull( this._groupDropdown ).getValue();
                if ( this._leafletMarker.attachedLayers[ 0 ] !== targetGroup ) {
                    leafletMarker = this._dataService.moveToGroup( this._leafletMarker, targetGroup );
                }
                // Open popup again and close this dialog
                leafletMarker.openPopup();
                this.dialog.close();
            } );
        }
        return null;
    }
};


module.exports = EditableMarkerPopup;
