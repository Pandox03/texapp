<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FabricType;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class FabricTypeController extends Controller
{
    public function __construct(private ActivityLogger $logger) {}

    public function index(Request $request): JsonResponse
    {
        $query = FabricType::query()->with('parent', 'children');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:50'],
            'parent_id' => ['nullable', 'exists:fabric_types,id'],
            'composition' => ['nullable', 'string', 'max:150'],
            'default_width_cm' => ['nullable', 'integer', 'min:1'],
            'default_gsm' => ['nullable', 'integer', 'min:1'],
            'description' => ['nullable', 'string'],
            'market_price_m2_mad' => ['nullable', 'numeric', 'min:0'],
            'target_margin_pct' => ['nullable', 'numeric', 'min:0', 'max:500'],
        ]);

        $fabricType = FabricType::create($data);

        Cache::forget('sale_form_options');

        $this->logger->log(
            $request->user(),
            $request,
            'created',
            "Type de tissu créé — {$fabricType->name}",
            'fabric_type',
            $fabricType->id,
        );

        return response()->json($fabricType, 201);
    }

    public function update(Request $request, FabricType $fabricType): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:50'],
            'parent_id' => ['nullable', 'exists:fabric_types,id'],
            'composition' => ['nullable', 'string', 'max:150'],
            'default_width_cm' => ['nullable', 'integer', 'min:1'],
            'default_gsm' => ['nullable', 'integer', 'min:1'],
            'description' => ['nullable', 'string'],
            'market_price_m2_mad' => ['nullable', 'numeric', 'min:0'],
            'target_margin_pct' => ['nullable', 'numeric', 'min:0', 'max:500'],
        ]);

        $fabricType->update($data);

        Cache::forget('sale_form_options');

        $this->logger->log(
            $request->user(),
            $request,
            'updated',
            "Type de tissu modifié — {$fabricType->name}",
            'fabric_type',
            $fabricType->id,
        );

        return response()->json($fabricType);
    }

    public function destroy(Request $request, FabricType $fabricType): JsonResponse
    {
        $name = $fabricType->name;
        $id = $fabricType->id;

        $fabricType->delete();

        $this->logger->log(
            $request->user(),
            $request,
            'deleted',
            "Type de tissu supprimé — {$name}",
            'fabric_type',
            $id,
        );

        return response()->json(null, 204);
    }
}
