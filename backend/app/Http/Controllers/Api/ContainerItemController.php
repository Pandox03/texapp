<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Container;
use App\Models\ContainerItem;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContainerItemController extends Controller
{
    public function __construct(private ActivityLogger $logger) {}

    public function store(Request $request, Container $container): JsonResponse
    {
        $data = $request->validate([
            'fabric_type_id' => ['required', 'exists:fabric_types,id'],
            'color_code' => ['nullable', 'string', 'max:50'],
            'color_name' => ['nullable', 'string', 'max:100'],
            'quantity_m2' => ['required', 'numeric', 'min:0.01'],
            'unit' => ['nullable', 'in:m2,kg'],
            'estimated_rolls' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['unit'] = \App\Support\QuantityUnit::normalize($data['unit'] ?? null);
        $fabric = \App\Models\FabricType::query()->find($data['fabric_type_id']);
        if ($data['unit'] === \App\Support\QuantityUnit::KG && ! $fabric?->default_gsm) {
            return response()->json([
                'message' => sprintf(
                    'Le grammage (g/m²) est requis pour enregistrer « %s » en kg.',
                    $fabric?->name ?? 'cet article',
                ),
            ], 422);
        }

        $colorCode = trim($data['color_code'] ?? '') ?: '-';

        $duplicate = $container->items()
            ->where('fabric_type_id', $data['fabric_type_id'])
            ->where('color_code', $colorCode)
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => 'Une ligne stock existe déjà pour ce type de tissu sur ce conteneur.',
            ], 422);
        }

        $item = $container->items()->create([
            ...$data,
            'color_code' => $colorCode,
            'color_name' => $data['color_name'] ?? null,
        ]);
        $item->load('fabricType');

        $this->logger->log(
            $request->user(),
            $request,
            'created',
            "Stock ajouté au conteneur {$container->reference} — {$data['color_code']}",
            'container_item',
            $item->id,
            ['container_id' => $container->id, 'color_code' => $data['color_code']],
        );

        return response()->json($item, 201);
    }

    public function update(Request $request, ContainerItem $containerItem): JsonResponse
    {
        $data = $request->validate([
            'fabric_type_id' => ['sometimes', 'exists:fabric_types,id'],
            'color_code' => ['sometimes', 'string', 'max:50'],
            'color_name' => ['nullable', 'string', 'max:100'],
            'quantity_m2' => ['sometimes', 'numeric', 'min:0.01'],
            'estimated_rolls' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $containerItem->update($data);
        $containerItem->load('fabricType');

        $this->logger->log(
            $request->user(),
            $request,
            'updated',
            "Stock modifié — {$containerItem->color_code}",
            'container_item',
            $containerItem->id,
        );

        return response()->json($containerItem);
    }

    public function destroy(Request $request, ContainerItem $containerItem): JsonResponse
    {
        $colorCode = $containerItem->color_code;
        $id = $containerItem->id;

        $containerItem->delete();

        $this->logger->log(
            $request->user(),
            $request,
            'deleted',
            "Ligne stock supprimée — {$colorCode}",
            'container_item',
            $id,
        );

        return response()->json(null, 204);
    }
}
