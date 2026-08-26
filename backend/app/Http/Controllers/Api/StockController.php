<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FabricRoll;
use App\Models\FabricType;
use App\Models\Sale;
use App\Models\StockReturn;
use App\Services\ActivityLogger;
use App\Services\StockReturnService;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use InvalidArgumentException;

class StockController extends Controller
{
    public function __construct(
        private StockService $stock,
        private StockReturnService $returns,
        private ActivityLogger $logger,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $lines = collect($this->stock->globalStockLines());

        if ($search = $request->string('search')->toString()) {
            $fabricTypeIds = FabricType::query()
                ->where('name', 'like', "%{$search}%")
                ->pluck('id');

            $lines = $lines->filter(fn (array $line) => $fabricTypeIds->contains($line['fabric_type_id']));
        }

        if ($fabricTypeId = $request->integer('fabric_type_id')) {
            $lines = $lines->where('fabric_type_id', $fabricTypeId);
        }

        $fabricTypes = FabricType::query()
            ->whereIn('id', $lines->pluck('fabric_type_id')->unique())
            ->get()
            ->keyBy('id');

        $items = $lines->map(function (array $line) use ($fabricTypes) {
            return [
                'fabric_type_id' => $line['fabric_type_id'],
                'fabric_type' => $fabricTypes->get($line['fabric_type_id']),
                'unit' => $line['unit'] ?? 'm2',
                'quantity_m2' => $line['total_m2'],
                'sold_m2' => $line['sold_m2'],
                'available_m2' => $line['available_m2'],
                'returned_m2' => $line['returned_m2'],
                'available_kg' => $line['available_kg'] ?? null,
                'total_kg' => $line['total_kg'] ?? null,
                'sold_kg' => $line['sold_kg'] ?? null,
                'returned_kg' => $line['returned_kg'] ?? null,
                'total_rolls' => $line['total_rolls'],
                'available_rolls' => $line['available_rolls'],
                'sold_rolls' => $line['sold_rolls'],
                'returned_rolls' => $line['returned_rolls'],
            ];
        })->values();

        $page = max(1, $request->integer('page', 1));
        $perPage = 20;
        $total = $items->count();
        $paginated = $items->slice(($page - 1) * $perPage, $perPage)->values();

        return response()->json([
            'summary' => $this->stock->globalSummary(),
            'items' => [
                'data' => $paginated,
                'current_page' => $page,
                'last_page' => max(1, (int) ceil($total / $perPage)),
                'per_page' => $perPage,
                'total' => $total,
            ],
        ]);
    }

    public function rolls(Request $request): JsonResponse
    {
        $query = FabricRoll::query()
            ->with(['container', 'fabricType', 'sale.client']);

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($fabricTypeId = $request->integer('fabric_type_id')) {
            $query->where('fabric_type_id', $fabricTypeId);
        }

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('roll_number', 'like', "%{$search}%")
                    ->orWhereHas('fabricType', fn ($t) => $t->where('name', 'like', "%{$search}%"));
            });
        }

        return response()->json($query->latest()->paginate(25));
    }

    public function returns(Request $request): JsonResponse
    {
        $query = StockReturn::query()
            ->with(['fabricType', 'client', 'sale', 'user'])
            ->latest('returned_at')
            ->latest('id');

        if ($fabricTypeId = $request->integer('fabric_type_id')) {
            $query->where('fabric_type_id', $fabricTypeId);
        }

        if ($clientId = $request->integer('client_id')) {
            $query->where('client_id', $clientId);
        }

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('reason', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('fabricType', fn ($t) => $t->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('client', fn ($c) => $c->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('sale', fn ($s) => $s->where('reference', 'like', "%{$search}%"));
            });
        }

        return response()->json($query->paginate(25));
    }

    public function returnableLines(Sale $sale): JsonResponse
    {
        return response()->json([
            'sale_id' => $sale->id,
            'reference' => $sale->reference,
            'client_id' => $sale->client_id,
            'lines' => $this->returns->returnableLines($sale),
        ]);
    }

    public function storeReturn(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sale_id' => ['required', 'exists:sales,id'],
            'fabric_type_id' => ['required', 'exists:fabric_types,id'],
            'quantity_m2' => ['required', 'numeric', 'min:0.01'],
            'unit' => ['nullable', 'in:m2,kg'],
            'roll_count' => ['required', 'integer', 'min:1'],
            'returned_at' => ['required', 'date'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $sale = Sale::query()->findOrFail($data['sale_id']);

        try {
            $result = $this->returns->apply(
                $sale,
                (int) $data['fabric_type_id'],
                (float) $data['quantity_m2'],
                (int) $data['roll_count'],
                $request->user()?->id,
                $data['returned_at'],
                $data['reason'] ?? null,
                $data['notes'] ?? null,
                $data['unit'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        Cache::forget('sale_form_options');

        /** @var StockReturn $retour */
        $retour = $result['retour'];

        $this->logger->log(
            $request->user(),
            $request,
            'created',
            "Retour stock — {$retour->fabricType?->name} ({$retour->quantity_m2} m²) sur vente {$sale->reference}",
            'stock_return',
            $retour->id,
            [
                'fabric_type_id' => $retour->fabric_type_id,
                'sale_id' => $retour->sale_id,
                'quantity_m2' => (float) $retour->quantity_m2,
                'roll_count' => $retour->roll_count,
                'removed_amount' => $result['removed_amount'] ?? null,
            ],
        );

        return response()->json($retour, 201);
    }

    public function storeFullReturn(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sale_id' => ['required', 'exists:sales,id'],
            'returned_at' => ['required', 'date'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $sale = Sale::query()->findOrFail($data['sale_id']);

        try {
            $result = $this->returns->applyFullSale(
                $sale,
                $request->user()?->id,
                $data['returned_at'],
                $data['reason'] ?? null,
                $data['notes'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        Cache::forget('sale_form_options');

        $count = count($result['retours']);
        $this->logger->log(
            $request->user(),
            $request,
            'created',
            "Retour stock complet — vente {$sale->reference} ({$count} article(s))",
            'sale',
            $sale->id,
            [
                'sale_id' => $sale->id,
                'returns_count' => $count,
                'removed_amount' => $result['removed_amount'] ?? null,
            ],
        );

        return response()->json([
            'retours' => $result['retours'],
            'sale' => $result['sale'],
            'removed_amount' => $result['removed_amount'],
        ], 201);
    }

    public function destroyReturn(Request $request, StockReturn $stockReturn): JsonResponse
    {
        if ($stockReturn->sale_id) {
            return response()->json([
                'message' => 'Impossible d\'annuler un retour lié à une vente. Corrigez plutôt via une nouvelle vente si besoin.',
            ], 422);
        }

        $label = $stockReturn->fabricType?->name ?? 'tissu';
        $id = $stockReturn->id;
        $qty = $stockReturn->quantity_m2;
        $stockReturn->delete();

        Cache::forget('sale_form_options');

        $this->logger->log(
            $request->user(),
            $request,
            'deleted',
            "Retour stock annulé — {$label} ({$qty} m²)",
            'stock_return',
            $id,
        );

        return response()->json(null, 204);
    }
}
