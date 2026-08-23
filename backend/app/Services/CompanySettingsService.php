<?php

namespace App\Services;

use App\Models\CompanySetting;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class CompanySettingsService
{
    private const CACHE_KEY = 'company_settings_config';

    public function isAvailable(): bool
    {
        return Schema::hasTable('company_settings');
    }

    public function instance(): CompanySetting
    {
        return CompanySetting::instance();
    }

    /**
     * Full company config (invoices, PDFs, emails).
     *
     * @return array<string, mixed>
     */
    public function config(): array
    {
        if (! $this->isAvailable()) {
            return $this->defaults();
        }

        return Cache::remember(self::CACHE_KEY, now()->addHour(), function () {
            $s = $this->instance();

            return [
                'app_name' => $s->app_name,
                'tagline' => $s->tagline,
                'name' => $s->legal_name,
                'legal_form' => $s->legal_form,
                'ice' => $s->ice ?? '',
                'rc' => $s->rc ?? '',
                'rc_city' => $s->rc_city ?? '',
                'address' => $s->address ?? '',
                'city' => $s->city ?? '',
                'country' => $s->country ?? 'Maroc',
                'activity' => $s->activity ?? '',
                'capital' => $s->capital ?? '',
                'phone' => $s->phone ?? '',
                'email' => $s->email ?? '',
                'if' => $s->if_number ?? '',
                'tp' => $s->tp_number ?? '',
                'cnss' => $s->cnss ?? '',
                'currency' => $s->currency ?? 'MAD',
                'tax_rate' => (float) ($s->tax_rate ?? 20),
                'default_payment_terms_days' => (int) ($s->default_payment_terms_days ?? 30),
                'logo_path' => $this->resolveLogoAbsolutePath($s->logo_path),
            ];
        });
    }

    /**
     * Public branding for login page and UI shell.
     *
     * @return array<string, mixed>
     */
    public function branding(): array
    {
        $config = $this->config();

        $appName = trim((string) ($config['app_name'] ?? 'TexFlow'));
        if ($appName === '' || preg_match('/abraje\\s*tex/i', $appName)) {
            $appName = 'TexFlow';
        }

        return [
            'app_name' => $appName,
            'tagline' => $config['tagline'],
            'legal_name' => $config['name'],
            'currency' => $config['currency'],
            'tax_rate' => $config['tax_rate'],
            'logo_url' => $this->logoUrl(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(array $data): CompanySetting
    {
        $setting = $this->instance();
        $setting->update($data);
        $this->clearCache();

        return $setting->fresh();
    }

    public function uploadLogo(UploadedFile $file): CompanySetting
    {
        $path = $file->store('company', 'public');
        $setting = $this->instance();

        if ($setting->logo_path && Storage::disk('public')->exists($setting->logo_path)) {
            Storage::disk('public')->delete($setting->logo_path);
        }

        $setting->update(['logo_path' => $path]);
        $this->clearCache();

        return $setting->fresh();
    }

    public function logoUrl(): ?string
    {
        $setting = $this->isAvailable() ? $this->instance() : null;
        $storedPath = $setting?->logo_path;

        if ($storedPath && Storage::disk('public')->exists($storedPath)) {
            return Storage::disk('public')->url($storedPath);
        }

        if (is_file(public_path('images/logo.png'))) {
            return rtrim((string) config('app.url'), '/').'/images/logo.png';
        }

        return null;
    }

    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * @return array<string, mixed>
     */
    private function defaults(): array
    {
        $d = config('company.defaults');
        if (! is_array($d)) {
            $d = [];
        }

        return [
            'app_name' => $d['app_name'] ?? env('APP_NAME', 'TexFlow'),
            'tagline' => $d['tagline'] ?? env('COMPANY_TAGLINE', 'Import textile & gestion de stock'),
            'name' => $d['legal_name'] ?? env('COMPANY_LEGAL_NAME', env('APP_NAME', 'Mon Entreprise')),
            'legal_form' => $d['legal_form'] ?? env('COMPANY_LEGAL_FORM', 'SARL'),
            'ice' => $d['ice'] ?? '',
            'rc' => $d['rc'] ?? '',
            'rc_city' => $d['rc_city'] ?? '',
            'address' => $d['address'] ?? '',
            'city' => $d['city'] ?? '',
            'country' => $d['country'] ?? 'Maroc',
            'activity' => $d['activity'] ?? '',
            'capital' => $d['capital'] ?? '',
            'phone' => $d['phone'] ?? '',
            'email' => $d['email'] ?? env('ADMIN_EMAIL', 'admin@example.com'),
            'if' => $d['if'] ?? '',
            'tp' => $d['tp'] ?? '',
            'cnss' => $d['cnss'] ?? '',
            'currency' => $d['currency'] ?? 'MAD',
            'tax_rate' => (float) ($d['tax_rate'] ?? 20),
            'default_payment_terms_days' => (int) ($d['default_payment_terms_days'] ?? 30),
            'logo_path' => config('company.logo_path'),
        ];
    }

    private function resolveLogoAbsolutePath(?string $storedPath): ?string
    {
        if ($storedPath && Storage::disk('public')->exists($storedPath)) {
            return Storage::disk('public')->path($storedPath);
        }

        $configured = config('company.logo_path');
        if ($configured) {
            $path = str_starts_with($configured, DIRECTORY_SEPARATOR) || preg_match('#^[A-Za-z]:\\\\#', $configured)
                ? $configured
                : base_path($configured);

            if (is_file($path)) {
                return $path;
            }
        }

        foreach ([public_path('images/logo.png'), public_path('logo.png')] as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }
}
