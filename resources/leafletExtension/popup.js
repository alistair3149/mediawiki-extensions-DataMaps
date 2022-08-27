module.exports = L.Popup.extend( {
    options: {
        className: 'datamap-popup'
    },

    setContent: function ( content ) {
        this.getContentManager = content;
        return this;
    },

	_updateContent: function () {
        if ( !this._contentNode ) {
            return;
        }

        if ( !this._content ) {
            this._content = this.getContentManager();
        }

        // Grant content node reference
        this._content.$content = $( this._contentNode );
        // Clear custom button area
        this.$customButtonArea.children().remove();
        // Grant custom button area reference
        this._content.$buttons = this.$customButtonArea;
        // Build custom buttons
        this._content.buildButtons();
        // Clear the content node
        this._content.$content.children().remove();
        // Build content
        this._content.build();
        // Build tools section
        this._content.$tools = $( '<ul class="datamap-popup-tools">' ).appendTo( this._content.$content );
		this._content.buildTools();
	},

	_initLayout: function () {
		L.Popup.prototype._initLayout.call( this );

        this.$customButtonArea = $( '<div class="datamap-popup-buttons">' ).appendTo( this._container );
	},

	onAdd: function ( map ) {
        this._updateContent();
        L.Popup.prototype.onAdd.call( this, map );
        this._content.onAdd();
    },

	onRemove: function ( map ) {
        L.Popup.prototype.onRemove.call( this, map );
        this._content.onRemove();
    }
} );