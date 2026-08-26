<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    protected $fillable = [
        'sale_id',
        'fabric_roll_id',
        'fabric_type_id',
        'unit_price',
        'quantity_m2',
        'unit',
        'line_total',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'quantity_m2' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    public function quantityUnit(): string
    {
        return \App\Support\QuantityUnit::normalize($this->unit ?? null);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function fabricRoll(): BelongsTo
    {
        return $this->belongsTo(FabricRoll::class);
    }

    public function fabricType(): BelongsTo
    {
        return $this->belongsTo(FabricType::class);
    }
}
