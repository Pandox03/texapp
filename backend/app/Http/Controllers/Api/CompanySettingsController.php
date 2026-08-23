<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use App\Services\CompanySettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompanySettingsController extends Controller
{
    public function __construct(
        private CompanySettingsService $settings,
        private ActivityLogger $logger,
    ) {}

    public function branding(): JsonResponse
    {
        return response()->json($this->settings->branding());
    }

    public function show(): JsonResponse
    {
        $setting = $this->settings->instance();

        return response()->json([
            ...$setting->toArray(),
            'logo_url' => $this->settings->logoUrl(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'app_name' => ['sometimes', 'string', 'max:120'],
            'tagline' => ['sometimes', 'string', 'max:200'],
            'legal_name' => ['sometimes', 'string', 'max:150'],
            'legal_form' => ['sometimes', 'string', 'max:50'],
            'ice' => ['nullable', 'string', 'max:50'],
            'rc' => ['nullable', 'string', 'max:50'],
            'rc_city' => ['nullable', 'string', 'max:80'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:80'],
            'country' => ['sometimes', 'string', 'max:80'],
            'activity' => ['nullable', 'string', 'max:255'],
            'capital' => ['nullable', 'string', 'max:80'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'if_number' => ['nullable', 'string', 'max:50'],
            'tp_number' => ['nullable', 'string', 'max:50'],
            'cnss' => ['nullable', 'string', 'max:50'],
            'currency' => ['sometimes', 'string', 'max:8'],
            'tax_rate' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'default_payment_terms_days' => ['sometimes', 'integer', 'min:0', 'max:365'],
        ]);

        $setting = $this->settings->update($data);

        $this->logger->log(
            $request->user(),
            $request,
            'updated',
            'Paramètres entreprise mis à jour',
            'company_settings',
            $setting->id,
        );

        return response()->json([
            ...$setting->fresh()->toArray(),
            'logo_url' => $this->settings->logoUrl(),
        ]);
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate([
            'logo' => ['required', 'image', 'max:2048'],
        ]);

        $setting = $this->settings->uploadLogo($request->file('logo'));

        $this->logger->log(
            $request->user(),
            $request,
            'updated',
            'Logo entreprise mis à jour',
            'company_settings',
            $setting->id,
        );

        return response()->json([
            'logo_url' => $this->settings->logoUrl(),
        ]);
    }
}
