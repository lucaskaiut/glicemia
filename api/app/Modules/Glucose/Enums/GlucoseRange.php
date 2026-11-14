<?php

namespace App\Modules\Glucose\Enums;

enum GlucoseRange: string
{
    case VERY_LOW = 'very_low';
    case LOW = 'low';
    case IN_RANGE = 'in_range';
    case HIGH = 'high';
    case VERY_HIGH = 'very_high';

    public static function classify(int $value): self
    {
        $r = config('glucose.ranges');

        return match (true) {
            $value < $r['very_low'] => self::VERY_LOW,
            $value < $r['low'] => self::LOW,
            $value <= $r['high'] => self::IN_RANGE,
            $value <= $r['very_high'] => self::HIGH,
            default => self::VERY_HIGH,
        };
    }
}
