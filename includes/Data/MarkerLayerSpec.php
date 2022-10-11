<?php
namespace MediaWiki\Extension\Ark\DataMaps\Data;

use MediaWiki\Extension\Ark\DataMaps\Rendering\Utils\DataMapColourUtils;
use Status;
use stdclass;

class MarkerLayerSpec extends DataModel {
    protected static string $publicName = 'MarkerLayerSpec';

    private string $id;

    public function __construct( string $id, stdclass $raw ) {
        parent::__construct( $raw );
        $this->id = $id;
    }

    public function getId(): string {
        return $this->id;
    }

    public function getName(): ?string {
        return isset( $this->raw->name ) ? $this->raw->name : null;
    }

    public function getPopupDiscriminator(): ?string {
        return isset( $this->raw->subtleText ) ? $this->raw->subtleText : null;
    }

    public function getIconOverride(): ?string {
        return isset( $this->raw->overrideIcon ) ? $this->raw->overrideIcon : null;
    }
    
    public function validate( Status $status ) {
        $this->checkField( $status, 'name', DataModel::TYPE_STRING );
        $this->checkField( $status, 'subtleText', DataModel::TYPE_STRING );
        $this->checkField( $status, [
            'name' => 'overrideIcon',
            'type' => DataModel::TYPE_FILE,
            'fileMustExist' => true
        ] );

        $this->disallowOtherFields( $status );
    }
}