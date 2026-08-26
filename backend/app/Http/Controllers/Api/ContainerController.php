<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Container;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ContainerController extends Controller
{
    public function __construct(private ActivityLogger $logger) {}

    public function index(Request $request): JsonResponse
    {
        $query = Container::query()->with(['fournisseur'])->withCount('items', 'rolls');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('reference', 'like', "%{$search}%")
                    ->orWhereHas('fournisseur', fn ($fq) => $fq->where('name', 'like', "%{$search}%"));
            });
        }

        if ($type = $request->string('type')->toString()) {
            $query->where('type', $type);
        }

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($from = $request->string('date_from')->toString()) {
            $query->whereDate('arrival_date', '>=', $from);
        }

        if ($to = $request->string('date_to')->toString()) {
            $query->whereDate('arrival_date', '<=', $to);
        }

        if ($request->boolean('lite')) {
            $containers = $query
                ->orderByDesc('arrival_date')
                ->select('id', 'reference', 'status', 'type')
                ->limit(min($request->integer('limit', 500), 1000))
                ->get();

            return response()->json($containers);
        }

        $containers = $query->with(['items.fabricType'])->latest('arrival_date')->paginate(15);

        $containers->getCollection()->transform(function (Container $container) {
            $totalM2 = round((float) $container->items->sum('quantity_m2'), 2);

            return array_merge($container->toArray(), [
                'stock_summary' => [
                    'lines_count' => $container->items->count(),
                    'total_m2' => $totalM2,
                ],
            ]);
        });

        return response()->json($containers);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reference' => ['required', 'string', 'max:100', 'unique:containers,reference'],
            'type' => ['required', 'in:local,container'],
            'fournisseur_id' => ['required', 'exists:fournisseurs,id'],
            'arrival_date' => ['required', 'date'],
            'origin' => ['nullable', 'string', 'max:100'],
            'supplier_reference' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:in_transit,arrived,processing,closed'],
            'notes' => ['nullable', 'string'],
            'purchase_cost_mad' => ['nullable', 'numeric', 'min:0'],
            'shipping_cost_mad' => ['nullable', 'numeric', 'min:0'],
            'customs_fees_mad' => ['nullable', 'numeric', 'min:0'],
            'other_fees_mad' => ['nullable', 'numeric', 'min:0'],
            'market_notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.fabric_type_id' => ['required', 'exists:fabric_types,id'],
            'items.*.color_code' => ['nullable', 'string', 'max:50'],
            'items.*.color_name' => ['nullable', 'string', 'max:100'],
            'items.*.quantity_m2' => ['required', 'numeric', 'min:0.01'],
            'items.*.unit' => ['nullable', 'in:m2,kg'],
            'items.*.estimated_rolls' => ['nullable', 'integer', 'min:0'],
            'items.*.notes' => ['nullable', 'string'],
        ]);

        if (($data['type'] ?? '') === 'local' && empty($data['origin'])) {
            $data['origin'] = 'Maroc';
        }

        try {
            $container = DB::transaction(function () use ($data) {
                $items = $data['items'];
                unset($data['items']);

                if (! isset($data['status'])) {
                    $data['status'] = 'arrived';
                }

                $container = Container::create($data);
                $seen = [];

                foreach ($items as $itemData) {
                    $colorCode = trim($itemData['color_code'] ?? '') ?: '-';
                    $key = $itemData['fabric_type_id'].'|'.$colorCode;

                    if (isset($seen[$key])) {
                        throw new InvalidArgumentException(
                            'Doublon dans le stock : même type de tissu saisi deux fois.'
                        );
                    }

                    $seen[$key] = true;

                    $unit = \App\Support\QuantityUnit::normalize($itemData['unit'] ?? null);
                    $fabric = \App\Models\FabricType::query()->find($itemData['fabric_type_id']);
                    if ($unit === \App\Support\QuantityUnit::KG && ! $fabric?->default_gsm) {
                        throw new InvalidArgumentException(sprintf(
                            'Le grammage (g/m²) est requis pour enregistrer « %s » en kg.',
                            $fabric?->name ?? 'cet article',
                        ));
                    }

                    $container->items()->create([
                        ...$itemData,
                        'unit' => $unit,
                        'color_code' => $colorCode,
                        'color_name' => $itemData['color_name'] ?? null,
                    ]);
                }

                return $container;
            });
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        Cache::forget('sale_form_options');

        $container->load(['items.fabricType', 'fournisseur']);

        $totalM2 = round((float) $container->items->sum('quantity_m2'), 2);
        $container->stock_summary = [
            'lines_count' => $container->items->count(),
            'total_m2' => $totalM2,
        ];

        $typeLabel = $container->type === 'local' ? 'Achat local' : 'Achat conteneur';
        $this->logger->log(
            $request->user(),
            $request,
            'created',
            "{$typeLabel} créé — {$container->reference} ({$container->items->count()} lignes stock)",
            'container',
            $container->id,
            ['reference' => $container->reference, 'type' => $container->type, 'lines' => $container->items->count()],
        );

        return response()->json($container, 201);
    }

    public function show(Container $container): JsonResponse
    {
        $container->load([
            'items.fabricType',
            'rolls.fabricType',
            'fournisseur',
        ]);

        $totalM2 = round((float) $container->items->sum('quantity_m2'), 2);
        $container->stock_summary = [
            'lines_count' => $container->items->count(),
            'total_m2' => $totalM2,
        ];

        return response()->json($container);
    }

    public function update(Request $request, Container $container): JsonResponse
    {
        $data = $request->validate([
            'reference' => ['sometimes', 'string', 'max:100', 'unique:containers,reference,'.$container->id],
            'type' => ['sometimes', 'in:local,container'],
            'fournisseur_id' => ['sometimes', 'exists:fournisseurs,id'],
            'arrival_date' => ['sometimes', 'date'],
            'origin' => ['nullable', 'string', 'max:100'],
            'supplier_reference' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:in_transit,arrived,processing,closed'],
            'notes' => ['nullable', 'string'],
            'purchase_cost_mad' => ['nullable', 'numeric', 'min:0'],
            'shipping_cost_mad' => ['nullable', 'numeric', 'min:0'],
            'customs_fees_mad' => ['nullable', 'numeric', 'min:0'],
            'other_fees_mad' => ['nullable', 'numeric', 'min:0'],
            'market_notes' => ['nullable', 'string'],
        ]);

        $container->update($data);
        $container->load('fournisseur');

        $this->logger->log(
            $request->user(),
            $request,
            'updated',
            "Achat modifié — {$container->reference}",
            'container',
            $container->id,
        );

        return response()->json($container);
    }

    public function destroy(Request $request, Container $container): JsonResponse
    {
        $reference = $container->reference;
        $id = $container->id;

        $container->delete();

        $this->logger->log(
            $request->user(),
            $request,
            'deleted',
            "Conteneur supprimé — {$reference}",
            'container',
            $id,
        );

        return response()->json(null, 204);
    }
}
