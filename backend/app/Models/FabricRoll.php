<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FabricRoll extends Model
{
    protected $fillable = [
        'container_id',
        'container_item_id',
        'fabric_type_id',
        'color_code',
        'roll_number',
        'order_number',
        'origin',
        'width_cm',
        'length_m',
        'quantity_m2',
        'unit',
        'gross_weight_kg',
        'net_weight_kg',
        'gsm',
        'composition',
        'status',
        'sale_id',
        'sold_at',
    ];

    protected function casts(): array
    {
        return [
            'length_m' => 'decimal:2',
            'quantity_m2' => 'decimal:2',
            'gross_weight_kg' => 'decimal:2',
            'net_weight_kg' => 'decimal:2',
            'sold_at' => 'datetime',
        ];
    }

    public function quantityUnit(): string
    {
        return \App\Support\QuantityUnit::normalize($this->unit ?? null);
    }

    public static function calculateM2(int $widthCm, float $lengthM): float
    {
        return round(($widthCm / 100) * $lengthM, 2);
    }

    public function container(): BelongsTo
    {
        return $this->belongsTo(Container::class);
    }

    public function containerItem(): BelongsTo
    {
        return $this->belongsTo(ContainerItem::class);
    }

    public function fabricType(): BelongsTo
    {
        return $this->belongsTo(FabricType::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }
}
