<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\FabricType;
use App\Services\PricingContextService;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class SaleFormController extends Controller
{
    public function __construct(
        private StockService $stock,
        private PricingContextService $pricing,
    ) {}

    public function formOptions(): JsonResponse
    {
        $data = Cache::remember('sale_form_options', 120, function () {
            return [
                'clients' => Client::query()
                    ->orderBy('name')
                    ->select('id', 'name', 'city', 'category')
                    ->limit(1000)
                    ->get(),
                'fabric_types' => FabricType::query()
                    ->orderBy('name')
                    ->select(
                        'id',
                        'name',
                        'composition',
                        'default_width_cm',
                        'default_gsm',
                        'unit',
                        'parent_id',
                        'market_price_m2_mad',
                        'target_margin_pct',
                    )
                    ->get(),
            ];
        });

        return response()->json($data);
    }

    public function stockAvailability(Request $request): JsonResponse
    {
        $data = $request->validate([
            'fabric_type_id' => ['required', 'exists:fabric_types,id'],
        ]);

        return response()->json($this->stock->availability((int) $data['fabric_type_id']));
    }

    /**
     * Cost + margin pricing basis (no AI): landed cost from containers + target margin.
     */
    public function pricingBasis(Request $request): JsonResponse
    {
        $data = $request->validate([
            'fabric_type_id' => ['required', 'exists:fabric_types,id'],
            'margin_pct' => ['nullable', 'numeric', 'min:0', 'max:500'],
        ]);

        $context = $this->pricing->buildForFabric((int) $data['fabric_type_id']);
        $landed = $context['avg_landed_cost_m2_mad'];
        $margin = isset($data['margin_pct'])
            ? (float) $data['margin_pct']
            : (float) $context['fabric']['target_margin_pct'];

        $suggested = $landed !== null
            ? round($landed * (1 + ($margin / 100)), 2)
            : null;

        return response()->json([
            'fabric_type_id' => (int) $data['fabric_type_id'],
            'fabric_type_name' => $context['fabric']['name'],
            'unit' => $context['fabric']['unit'],
            'landed_cost_m2_mad' => $landed,
            'target_margin_pct' => $margin,
            'suggested_price_m2_mad' => $suggested,
            'market_price_m2_mad' => $context['fabric']['market_price_m2_mad'],
            'has_container_costs' => $landed !== null,
            'landed_costs' => $context['landed_costs'],
        ]);
    }
}
