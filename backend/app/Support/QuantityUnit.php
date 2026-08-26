<?php

namespace App\Support;

use InvalidArgumentException;

final class QuantityUnit
{
    public const M2 = 'm2';

    public const KG = 'kg';

    /** @return list<string> */
    public static function all(): array
    {
        return [self::M2, self::KG];
    }

    public static function normalize(?string $unit): string
    {
        return $unit === self::KG ? self::KG : self::M2;
    }

    public static function label(?string $unit): string
    {
        return self::normalize($unit) === self::KG ? 'kg' : 'm²';
    }

    public static function priceSuffix(?string $unit): string
    {
        return 'MAD/'.self::label($unit);
    }

    /**
     * Convert a quantity to m² using GSM (g/m²).
     * kg = m² × gsm / 1000  ⇒  m² = kg × 1000 / gsm
     */
    public static function toM2(float $quantity, ?string $unit, ?int $gsm): float
    {
        $quantity = round($quantity, 2);
        $unit = self::normalize($unit);

        if ($unit === self::M2) {
            return $quantity;
        }

        if (! $gsm || $gsm < 1) {
            throw new InvalidArgumentException(
                'Le grammage (g/m²) de l\'article est requis pour convertir les kg en m².'
            );
        }

        return round($quantity * 1000 / $gsm, 2);
    }

    /**
     * Convert a quantity to kg using GSM (g/m²).
     */
    public static function toKg(float $quantity, ?string $unit, ?int $gsm): float
    {
        $quantity = round($quantity, 2);
        $unit = self::normalize($unit);

        if ($unit === self::KG) {
            return $quantity;
        }

        if (! $gsm || $gsm < 1) {
            throw new InvalidArgumentException(
                'Le grammage (g/m²) de l\'article est requis pour convertir les m² en kg.'
            );
        }

        return round($quantity * $gsm / 1000, 2);
    }

    /**
     * Convert quantity from one unit to another.
     */
    public static function convert(float $quantity, ?string $from, ?string $to, ?int $gsm): float
    {
        $from = self::normalize($from);
        $to = self::normalize($to);

        if ($from === $to) {
            return round($quantity, 2);
        }

        $asM2 = self::toM2($quantity, $from, $gsm);

        return $to === self::KG ? self::toKg($asM2, self::M2, $gsm) : $asM2;
    }
}
