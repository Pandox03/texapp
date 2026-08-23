<?php

return [
    /*
    | Defaults used before DB migration or as fallback.
    | Runtime values come from company_settings (see CompanySettingsService).
    */
    'defaults' => [
        'app_name' => env('APP_NAME', 'TexFlow'),
        'tagline' => env('COMPANY_TAGLINE', 'Import textile & gestion de stock'),
        'legal_name' => env('COMPANY_LEGAL_NAME', env('APP_NAME', 'Mon Entreprise')),
        'legal_form' => env('COMPANY_LEGAL_FORM', 'SARL'),
        'ice' => env('COMPANY_ICE', ''),
        'rc' => env('COMPANY_RC', ''),
        'rc_city' => env('COMPANY_RC_CITY', ''),
        'address' => env('COMPANY_ADDRESS', ''),
        'city' => env('COMPANY_CITY', ''),
        'country' => env('COMPANY_COUNTRY', 'Maroc'),
        'activity' => env('COMPANY_ACTIVITY', ''),
        'capital' => env('COMPANY_CAPITAL', ''),
        'phone' => env('COMPANY_PHONE', ''),
        'email' => env('COMPANY_EMAIL', env('ADMIN_EMAIL', 'admin@example.com')),
        'if' => env('COMPANY_IF', ''),
        'tp' => env('COMPANY_TP', ''),
        'cnss' => env('COMPANY_CNSS', ''),
        'currency' => env('COMPANY_CURRENCY', 'MAD'),
        'tax_rate' => (float) env('COMPANY_TAX_RATE', 20),
        'default_payment_terms_days' => (int) env('COMPANY_PAYMENT_TERMS', 30),
    ],

    'logo_path' => env('COMPANY_LOGO_PATH'),
];
