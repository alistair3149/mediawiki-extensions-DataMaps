/** @typedef {import( '../editor.js' )} MapVisualEditor */
const VePanel = require( './base.js' ),
    DataEditorUiBuilder = require( '../data/editor.js' ),
    { Util } = require( 'ext.datamaps.core' );


module.exports = class MarkerGroupsEditorPanel extends VePanel {
    /**
     * @param {MapVisualEditor} editor
     */
    constructor( editor ) {
        super( editor, 'datamap-ve-panel-mgroups' );

    }


    /**
     * @protected
     * @param {boolean} value
     */
    _setLock( value ) {
        //this.uiBuilder.setLock( value );
    }


    /**
     * @protected
     */
    _cleanUpData() {
    }
};
