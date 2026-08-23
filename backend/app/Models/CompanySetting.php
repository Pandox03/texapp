<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanySetting extends Model
{
    protected $fillable = [
        'app_name',
        'tagline',
        'legal_name',
        'legal_form',
        'ice',
        'rc',
        'rc_city',
        'address',
        'city',
        'country',
        'activity',
        'capital',
        'phone',
        'email',
        'if_number',
        'tp_number',
        'cnss',
        'currency',
        'tax_rate',
        'default_payment_terms_days',
        'logo_path',
    ];

    protected function casts(): array
    {
        return [
            'tax_rate' => 'float',
            'default_payment_terms_days' => 'integer',
        ];
    }

    public static function instance(): self
    {
        return static::query()->firstOrCreate([], [
            'app_name' => config('company.defaults.app_name'),
            'tagline' => config('company.defaults.tagline'),
            'legal_name' => config('company.defaults.legal_name'),
            'legal_form' => config('company.defaults.legal_form'),
            'country' => config('company.defaults.country'),
            'currency' => config('company.defaults.currency'),
            'tax_rate' => config('company.defaults.tax_rate'),
            'default_payment_terms_days' => config('company.defaults.default_payment_terms_days'),
            'email' => config('company.defaults.email'),
        ]);
    }
}
