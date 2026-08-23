<?php

namespace App\Providers;

use App\Services\CompanySettingsService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        try {
            // Flatten runtime fields for PDFs/emails, but keep defaults nested for fallbacks.
            $defaults = config('company.defaults', []);
            $logoPath = config('company.logo_path');
            Config::set('company', array_merge(
                app(CompanySettingsService::class)->config(),
                [
                    'defaults' => is_array($defaults) ? $defaults : [],
                    'logo_path' => $logoPath,
                ]
            ));
        } catch (\Throwable) {
            // Install / migrate edge cases.
        }
    }
}
