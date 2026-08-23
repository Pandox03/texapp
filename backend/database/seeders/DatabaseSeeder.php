<?php

namespace Database\Seeders;

use App\Models\CompanySetting;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Production-safe bootstrap: company settings + initial admin user.
     */
    public function run(): void
    {
        CompanySetting::firstOrCreate([], [
            'app_name' => env('APP_NAME', 'TexFlow'),
            'tagline' => env('COMPANY_TAGLINE', 'Import textile & gestion de stock'),
            'legal_name' => env('COMPANY_LEGAL_NAME', env('APP_NAME', 'Mon Entreprise')),
            'legal_form' => env('COMPANY_LEGAL_FORM', 'SARL'),
            'ice' => env('COMPANY_ICE'),
            'rc' => env('COMPANY_RC'),
            'rc_city' => env('COMPANY_RC_CITY'),
            'address' => env('COMPANY_ADDRESS'),
            'city' => env('COMPANY_CITY'),
            'country' => env('COMPANY_COUNTRY', 'Maroc'),
            'activity' => env('COMPANY_ACTIVITY'),
            'capital' => env('COMPANY_CAPITAL'),
            'phone' => env('COMPANY_PHONE'),
            'email' => env('COMPANY_EMAIL', env('ADMIN_EMAIL')),
            'if_number' => env('COMPANY_IF'),
            'tp_number' => env('COMPANY_TP'),
            'cnss' => env('COMPANY_CNSS'),
            'currency' => env('COMPANY_CURRENCY', 'MAD'),
            'tax_rate' => env('COMPANY_TAX_RATE', 20),
            'default_payment_terms_days' => env('COMPANY_PAYMENT_TERMS', 30),
        ]);

        $email = (string) env('ADMIN_EMAIL', 'admin@example.com');
        $password = env('ADMIN_PASSWORD');

        if (! is_string($password) || $password === '') {
            if (app()->environment('production')) {
                $this->command?->warn('ADMIN_PASSWORD is not set. No admin user was seeded.');

                return;
            }

            $password = 'password';
            $this->command?->warn('Using default local admin password ("password"). Set ADMIN_PASSWORD in production.');
        }

        User::updateOrCreate(
            ['email' => $email],
            [
                'name' => (string) env('ADMIN_NAME', 'Administrateur'),
                'password' => $password,
                'role' => 'admin',
            ]
        );

        $this->command?->info("Admin user ready: {$email}");
    }
}
