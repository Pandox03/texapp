<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FabricType extends Model
{
    protected $fillable = [
        'name',
        'code',
        'parent_id',
        'composition',
        'default_width_cm',
        'default_gsm',
        'description',
        'market_price_m2_mad',
        'target_margin_pct',
    ];

    protected function casts(): array
    {
        return [
            'market_price_m2_mad' => 'decimal:2',
            'target_margin_pct' => 'decimal:2',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(FabricType::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(FabricType::class, 'parent_id');
    }

    public function containerItems(): HasMany
    {
        return $this->hasMany(ContainerItem::class);
    }

    public function rolls(): HasMany
    {
        return $this->hasMany(FabricRoll::class);
    }
}
