const config = require( './config.json' ),
    URL_PARAMETER = 'marker';


var getMarkerUID = function ( map, markerType, instance ) {
    return ( instance[2] && instance[2].uid != null ) ? instance[2].uid : map.storage.getMarkerKey( markerType, instance );
};


var getMarkerURL = function ( map, persistentMarkerId ) {
    const params = new URLSearchParams( window.location.search );
    if ( persistentMarkerId ) {
        params.set( URL_PARAMETER, persistentMarkerId );
    } else {
        params.delete( URL_PARAMETER );
    }

    const tabber = map.getParentTabberNeueId();
    return decodeURIComponent( `${window.location.pathname}?${params}`.replace( /\?$/, '' )
        + ( tabber ? ( '#' + tabber ) : window.location.hash ) );
};


var updateLocation = function ( map, persistentMarkerId ) {
    history.replaceState( {}, '', getMarkerURL( map, persistentMarkerId ) );
};


function MarkerPopup( map, markerType, instance, slots, leafletMarker ) {
    this.map = map;
    this.markerType = markerType;
    this.markerLayers = markerType.split( ' ' );
    this.markerGroup = map.config.groups[this.markerLayers[0]];
    this.instance = instance;
    this.slots = slots;
    this.leafletMarker = leafletMarker;
    // These two containers are provided by L.Ark.Popup
    this.$content = null;
    this.$tools = null;
}


MarkerPopup.URL_PARAMETER = URL_PARAMETER;


MarkerPopup.bindTo = function ( map, markerType, instance, slots, leafletMarker ) {
    leafletMarker.bindPopup( () => new MarkerPopup( map, markerType, instance, slots, leafletMarker ), {}, L.Ark.Popup );
};


MarkerPopup.prototype.getDismissToolText = function () {
    return mw.msg( 'datamap-popup-' + ( this.map.storage.isDismissed( this.markerType, this.instance )
        ? 'dismissed' : 'mark-as-dismissed' ) );
};


/*
 * Builds popup contents for a marker instance
 */
MarkerPopup.prototype.build = function () {
    // Build the title
    if ( this.slots.label && this.markerGroup.name !== this.slots.label ) {
        $( '<b class="datamap-popup-subtitle">' ).text( this.markerGroup.name ).appendTo( this.$content );
        $( '<b class="datamap-popup-title">' ).text( this.slots.label ).appendTo( this.$content );
    } else {
        $( '<b class="datamap-popup-title">' ).text( this.markerGroup.name ).appendTo( this.$content );
    }
    
    // Collect layer discriminators
    const discrims = [];
    this.markerLayers.forEach( ( layerId, index ) => {
        if ( index > 0 && this.map.config.layers[layerId] ) {
            discrims.push( this.map.config.layers[layerId].discrim );
        }
    } );

    // Coordinates
    // TODO: this is not displayed if coordinates are disabled
    let coordText = this.map.getCoordLabel( this.instance[0], this.instance[1] );
    if ( discrims.length > 0 ) {
        coordText += ` (${ discrims.join( ', ' ) })`;
    }
    if ( config.DataMapsShowCoordinatesDefault ) {
        $( '<div class="datamap-popup-coordinates">' ).text( coordText ).appendTo( this.$content );
    }

    // Description
    if ( this.slots.desc ) {
        if ( !this.slots.desc.startsWith( '<p>' ) ) {
            this.slots.desc = `<p>${this.slots.desc}</p>`;
        }
        this.$content.append( this.slots.desc );
    }

    // Image
    if ( this.slots.image ) {
        $( '<img class="datamap-popup-image" width=240 />' ).attr( 'src', this.slots.image ).appendTo( this.$content );
    }
};


MarkerPopup.prototype.addTool = function ( cssClass, $child ) {
    return $( `<li class="${cssClass}">` ).append( $child ).appendTo( this.$tools );
};


MarkerPopup.prototype.buildTools = function () {
    // Related article
    const article = this.slots.article || this.markerGroup.article;
    if ( article ) {
        this.addTool( 'datamap-popup-seemore',
            $( '<a>' ).attr( 'href', mw.util.getUrl( article ) ).text( mw.msg( 'datamap-popup-related-article' ) ) );
    }

    // Dismissables
    if ( this.markerGroup.canDismiss ) {
        this.addTool( 'datamap-popup-dismiss',
            $( '<a>' )
                .text( this.getDismissToolText() )
                .on( 'click', () => {
                    this.map.toggleMarkerDismissal( this.markerType, this.instance, this.leafletMarker );
                    this.map.leaflet.closePopup();
                } )
        );
    }

    return this.$tools;
};


MarkerPopup.prototype.onAdd = function () {
    updateLocation( this.map, getMarkerUID( this.map, this.markerType, this.instance ) );
};


MarkerPopup.prototype.onRemove = function () {
    updateLocation( this.map, null );
};


module.exports = MarkerPopup;