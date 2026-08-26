<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Container extends Model
{
    protected $fillable = [
        'reference',
        'type',
        'fournisseur_id',
        'arrival_date',
        'origin',
        'supplier_reference',
        'status',
        'notes',
        'purchase_cost_mad',
        'shipping_cost_mad',
        'customs_fees_mad',
        'other_fees_mad',
        'market_notes',
    ];

    protected function casts(): array
    {
        return [
            'arrival_date' => 'date',
            'purchase_cost_mad' => 'decimal:2',
            'shipping_cost_mad' => 'decimal:2',
            'customs_fees_mad' => 'decimal:2',
            'other_fees_mad' => 'decimal:2',
        ];
    }

    public function fournisseur(): BelongsTo
    {
        return $this->belongsTo(Fournisseur::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(ContainerItem::class);
    }

    public function rolls(): HasMany
    {
        return $this->hasMany(FabricRoll::class);
    }

    public function isLocal(): bool
    {
        return $this->type === 'local';
    }

    public function isContainerAchat(): bool
    {
        return $this->type === 'container';
    }
}
