<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockReturn extends Model
{
    protected $fillable = [
        'fabric_type_id',
        'client_id',
        'sale_id',
        'user_id',
        'quantity_m2',
        'unit',
        'roll_count',
        'returned_at',
        'reason',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity_m2' => 'decimal:2',
            'returned_at' => 'date',
            'roll_count' => 'integer',
        ];
    }

    public function quantityUnit(): string
    {
        return \App\Support\QuantityUnit::normalize($this->unit ?? null);
    }

    public function fabricType(): BelongsTo
    {
        return $this->belongsTo(FabricType::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
