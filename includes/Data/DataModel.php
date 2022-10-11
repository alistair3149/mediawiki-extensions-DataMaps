<?php
namespace MediaWiki\Extension\Ark\DataMaps\Data;

use Status;
use stdClass;
use InvalidArgumentException;
use MediaWiki\Extension\Ark\DataMaps\Rendering\Utils\DataMapFileUtils;
use MediaWiki\Extension\Ark\DataMaps\Rendering\Utils\DataMapColourUtils;

class DataModel {
    protected static string $publicName = '???';

    const TYPE_ANY = 0;
    const TYPE_ARRAY = 1;
    const TYPE_STRING = 2;
    const TYPE_BOOL = 3;
    const TYPE_NUMBER = 4;
    const TYPE_OBJECT = 5;
    const TYPE_VECTOR2 = 11;
    const TYPE_DIMENSIONS = 12;
    const TYPE_VECTOR2x2 = 13;
    const TYPE_BOUNDS = self::TYPE_VECTOR2x2;
    const TYPE_COLOUR3 = 14;
    const TYPE_STRING_OR_NUMBER = 15; // TODO: drop deprecated union type
    const TYPE_COLOUR4 = 16;
    const TYPE_ARRAY_OR_STRING = 17; // TODO: drop deprecated union type
    const TYPE_BOOL_OR_STRING = 18; // TODO: drop deprecated union type
    const TYPE_FILE = 19;

    protected stdClass $raw;
    private array $validationCheckedFields = [];
    protected bool $validationAreRequiredFieldsPresent = true;

    public function __construct( stdClass $raw ) {
        if ( is_array( $raw ) ) {
            $raw = (object) $raw;
        }
        $this->raw = $raw;
    }

    protected function verifyType( $var, int $typeId ): bool {
        switch ( $typeId ) {
            case self::TYPE_ANY:
                return true;
            case self::TYPE_ARRAY:
                // A[ ... ]
                return is_array( $var );
            case self::TYPE_STRING:
            case self::TYPE_FILE:
                // S""
                return is_string( $var );
            case self::TYPE_BOOL:
                // B
                return is_bool( $var );
            case self::TYPE_NUMBER:
                // N
                return is_numeric( $var );
            case self::TYPE_OBJECT:
                // O{ ... }
                return $var instanceof stdClass;
            case self::TYPE_VECTOR2:
                // [ Na, Nb ]
                return is_array( $var ) && count( $var ) == 2 && is_numeric( $var[0] ) && is_numeric( $var[1] );
            case self::TYPE_DIMENSIONS:
                // Nab || [ Na, Nb ]
                return is_numeric( $var ) || $this->verifyType( $var, self::TYPE_VECTOR2 );
            case self::TYPE_VECTOR2x2:
                // [ [ Na, Nb ], [ Nc, Nd ] ]
                return is_array( $var ) && count( $var ) == 2
                    && $this->verifyType( $var[0], self::TYPE_VECTOR2 ) && $this->verifyType( $var[1], self::TYPE_VECTOR2 );
            case self::TYPE_COLOUR3:
                // S"#rrggbb" || S"#rgb" || [ Nr, Ng, Nb ]
                return DataMapColourUtils::decode( $var ) !== null;
            // TODO: deprecated union type
            case self::TYPE_STRING_OR_NUMBER:
                return is_string( $var ) || is_numeric( $var );
            case self::TYPE_COLOUR4:
                // S"#rrggbbaa" || S"#rgba" || [ Nr, Ng, Nb, Na ]
                return DataMapColourUtils::decode4( $var ) !== null;
            // TODO: deprecated union type
            case self::TYPE_ARRAY_OR_STRING:
                // S"" || A[ ... ]
                return is_array( $var ) || is_string( $var );
            // TODO: deprecated union type
            case self::TYPE_BOOL_OR_STRING:
                // B || A[ ... ]
                return is_bool( $var ) || is_string( $var );
        }
        throw new InvalidArgumentException( wfMessage( 'datamap-error-internal-unknown-field-type', $typeId ) );
    }

    protected function allowOnly( Status $status, array $fields ) {
        $unexpected = array_diff( array_keys( get_object_vars( $this->raw ) ), $fields );
        if ( !empty( $unexpected ) ) {
            $status->fatal( 'datamap-error-validate-unexpected-fields', static::$publicName, wfEscapeWikiText(
                implode( ', ', $unexpected ) ) );
        }
    }

    protected function trackField( string $name ) {
        $this->validationCheckedFields[] = $name;
    }

    protected function disallowOtherFields( Status $status ) {
        $this->allowOnly( $status, $this->validationCheckedFields );
    }

    protected function conflict( Status $status, array $fields ): bool {
        $count = 0;
        foreach ( $fields as &$name ) {
            if ( isset( $this->raw->$name ) ) {
                $count++;
            }
        }
        if ( $count > 1 ) {
            $status->fatal( 'datamap-error-validate-exclusive-fields', static::$publicName, implode( ', ', $fields ) );
            return true;
        }
        return false;
    }

    protected function checkField( Status $status, /*array|string*/ $spec, ?int $type = null ): bool {
        if ( is_string( $spec ) ) {
            return $this->checkField( $status, [
                'name' => $spec,
                'type' => $type
            ] );
        }

        $result = true;

        $isRequired = $spec['required'] ?? false;
        $name = $spec['name'] ?? null;
        $types = $spec['type'];
        if ( !is_array( $types ) ) {
            $types = [$types];
        }

        if ( isset( $spec['names'] ) ) {
            if ( !$this->conflict( $status, $spec['names'] ) ) {
                foreach ( $spec['names'] as &$candidate ) {
                    if ( isset( $this->raw->$candidate ) ) {
                        $name = $candidate;
                        break;
                    }
                }
            }
        }

        if ( $isRequired && ( $name === null || !isset( $this->raw->$name ) ) ) {
            // TODO: display right name if there's multiples
            $status->fatal( 'datamap-error-validate-field-required', static::$publicName, $name,
                wfMessage( 'datamap-error-validate-check-docs' ) );
            $this->validationAreRequiredFieldsPresent = false;
            return false;
        }

        if ( !$isRequired && !isset( $this->raw->$name ) ) {
            return true;
        }

        if ( $name === null ) {
            return true;
        }

        if ( isset( $spec['@replaced'] ) ) {
            $info = $spec['@replaced'];
            $status->warning( 'datamap-error-validate-replaced-field', static::$publicName, $name, $info[2], $info[0],
                $info[1] );
        } else if ( isset( $spec['@pendingRemoval'] ) ) {
            $info = $spec['@replaced'];
            $status->warning( 'datamap-error-validate-deprecated-field', static::$publicName, $name, $info[0],
                $info[1] );
        }

        $this->trackField( $name );

        $value = $this->raw->$name ?? null;

        $type = null;
        foreach ( $types as &$candidate ) {
            if ( $this->verifyType( $value, $candidate ) ) {
                $type = $candidate;
                break;
            }
        }

        if ( $type === null ) {
            $status->fatal( 'datamap-error-validate-wrong-field-type', static::$publicName, $name,
                wfMessage( 'datamap-error-validate-check-docs' ) );
            return false;
        }

        if ( $type === self::TYPE_FILE && ( $spec['fileMustExist'] ?? false ) ) {
            if ( empty( $value ) ) {
                $status->fatal( 'datamap-error-validate-field-no-value', static::$publicName, $name );
                return false;
            }

            $file = DataMapFileUtils::getFile( $value );
            if ( !$file || !$file->exists() ) {
                $status->fatal( 'datamap-error-validate-no-file', wfEscapeWikiText( trim( $value ) ) );
                return false;
            }
        }

        if ( isset( $spec['check'] ) ) {
            if ( !$spec['check']( $status, $value ) ) {
                return false;
            }
        }

        if ( $type === self::TYPE_ARRAY ) {
            if ( isset( $spec['values'] ) ) {
                foreach ( $value as &$item ) {
                    if ( !in_array( $item, $spec['values'] ) ) {
                        // TODO: display message for bad value
                        return false;
                    }
                }
            }

            if ( isset( $spec['itemType'] ) ) {
                foreach ( $value as &$item ) {
                    if ( !$this->verifyType( $item, $spec['itemType'] ) ) {
                        // TODO: display message for bad item type
                        return false;
                    }
                }
            }

            if ( isset( $spec['itemCheck'] ) ) {
                foreach ( $value as &$item ) {
                    if ( !$spec['itemCheck']( $status, $item ) ) {
                        return false;
                    }
                }
            }
        } else {
            if ( isset( $spec['values'] ) && !in_array( $value, $spec['values'] ) ) {
                // TODO: display message for bad value
                return false;
            }
        }

        return true;
    }

    public function validate( Status $status ) { }
}