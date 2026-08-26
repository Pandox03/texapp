<?php

namespace App\Services;

use App\Models\Client;
use App\Models\ContainerItem;
use App\Models\FabricType;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Support\Facades\DB;

class PricingContextService
{
    public function buildForFabric(int $fabricTypeId, ?int $clientId = null): array
    {
        $fabric = FabricType::findOrFail($fabricTypeId);

        $landedCosts = $this->landedCostsForFabric($fabricTypeId);
        $salesStats = $this->salesStatsForFabric($fabricTypeId);
        $clientStats = $clientId ? $this->clientStatsForFabric($clientId, $fabricTypeId) : null;

        $avgLanded = collect($landedCosts)
            ->pluck('landed_cost_m2_mad')
            ->filter()
            ->avg();

        return [
            'fabric' => [
                'id' => $fabric->id,
                'name' => $fabric->name,
                'composition' => $fabric->composition,
                'unit' => $fabric->quantityUnit(),
                'market_price_m2_mad' => $fabric->market_price_m2_mad !== null
                    ? (float) $fabric->market_price_m2_mad
                    : null,
                'target_margin_pct' => $fabric->target_margin_pct !== null
                    ? (float) $fabric->target_margin_pct
                    : 25.0,
            ],
            'landed_costs' => $landedCosts,
            'avg_landed_cost_m2_mad' => $avgLanded ? round((float) $avgLanded, 2) : null,
            'sales_history' => $salesStats,
            'client_history' => $clientStats,
        ];
    }

    public function buildClientSummaryData(Client $client): array
    {
        $billing = app(BillingService::class);
        $balance = $billing->clientBalance($client);

        $recentSales = Sale::query()
            ->where('client_id', $client->id)
            ->latest('sale_date')
            ->limit(5)
            ->get(['reference', 'sale_type', 'sale_date', 'total_amount', 'payment_status', 'paid_amount']);

        $recentPayments = Payment::query()
            ->where('client_id', $client->id)
            ->where('status', 'confirmed')
            ->latest('payment_date')
            ->limit(5)
            ->get(['reference', 'payment_date', 'amount', 'method', 'sale_id']);

        $recentCredits = Sale::query()
            ->where('client_id', $client->id)
            ->where('sale_type', 'legacy_credit')
            ->latest('sale_date')
            ->limit(3)
            ->get(['reference', 'sale_date', 'total_amount', 'payment_status', 'paid_amount']);

        return [
            'client' => [
                'name' => $client->name,
                'city' => $client->city,
                'category' => $client->category,
                'credit_limit' => $client->credit_limit !== null ? (float) $client->credit_limit : null,
                'payment_terms_days' => $client->payment_terms_days,
                'notes' => $client->notes,
            ],
            'balance' => $balance,
            'recent_sales' => $recentSales->map(fn ($s) => [
                'reference' => $s->reference,
                'type' => $s->sale_type ?? 'stock',
                'date' => $s->sale_date?->toDateString(),
                'total' => (float) $s->total_amount,
                'payment_status' => $s->payment_status,
                'paid' => (float) $s->paid_amount,
            ])->all(),
            'recent_credits' => $recentCredits->map(fn ($s) => [
                'reference' => $s->reference,
                'date' => $s->sale_date?->toDateString(),
                'total' => (float) $s->total_amount,
                'payment_status' => $s->payment_status,
                'paid' => (float) $s->paid_amount,
            ])->all(),
            'recent_payments' => $recentPayments->map(fn ($p) => [
                'reference' => $p->reference,
                'date' => $p->payment_date?->toDateString(),
                'amount' => (float) $p->amount,
                'method' => $p->method,
                'on_credit' => $p->sale_id !== null,
            ])->all(),
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function landedCostsForFabric(int $fabricTypeId): array
    {
        $items = ContainerItem::query()
            ->where('fabric_type_id', $fabricTypeId)
            ->with(['container.items'])
            ->latest('id')
            ->limit(8)
            ->get();

        $results = [];

        foreach ($items as $item) {
            $container = $item->container;
            if (! $container) {
                continue;
            }

            $totalFees = (float) ($container->purchase_cost_mad ?? 0)
                + (float) ($container->shipping_cost_mad ?? 0)
                + (float) ($container->customs_fees_mad ?? 0)
                + (float) ($container->other_fees_mad ?? 0);

            if ($totalFees <= 0) {
                continue;
            }

            $containerTotalM2 = (float) $container->items->sum('quantity_m2');
            $itemM2 = (float) $item->quantity_m2;

            if ($containerTotalM2 <= 0 || $itemM2 <= 0) {
                continue;
            }

            $itemFeeShare = $totalFees * ($itemM2 / $containerTotalM2);
            $landedPerM2 = round($itemFeeShare / $itemM2, 2);

            $results[] = [
                'container_reference' => $container->reference,
                'arrival_date' => $container->arrival_date?->toDateString(),
                'item_m2' => round($itemM2, 2),
                'total_fees_mad' => round($totalFees, 2),
                'landed_cost_m2_mad' => $landedPerM2,
                'market_notes' => $container->market_notes,
            ];
        }

        return $results;
    }

    /** @return array<string, mixed> */
    private function salesStatsForFabric(int $fabricTypeId): array
    {
        $row = DB::table('sale_items')
            ->join('fabric_rolls', 'sale_items.fabric_roll_id', '=', 'fabric_rolls.id')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('fabric_rolls.fabric_type_id', $fabricTypeId)
            ->where(function ($q) {
                $q->where('sales.sale_type', 'stock')->orWhereNull('sales.sale_type');
            })
            ->selectRaw('COUNT(*) as sales_count')
            ->selectRaw('AVG(sale_items.unit_price) as avg_price')
            ->selectRaw('MIN(sale_items.unit_price) as min_price')
            ->selectRaw('MAX(sale_items.unit_price) as max_price')
            ->first();

        $recent = DB::table('sale_items')
            ->join('fabric_rolls', 'sale_items.fabric_roll_id', '=', 'fabric_rolls.id')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('fabric_rolls.fabric_type_id', $fabricTypeId)
            ->orderByDesc('sales.sale_date')
            ->limit(5)
            ->get([
                'sales.reference',
                'sales.sale_date',
                'sale_items.unit_price',
                'sale_items.quantity_m2',
            ]);

        return [
            'sales_count' => (int) ($row->sales_count ?? 0),
            'avg_price_m2_mad' => $row->avg_price ? round((float) $row->avg_price, 2) : null,
            'min_price_m2_mad' => $row->min_price ? round((float) $row->min_price, 2) : null,
            'max_price_m2_mad' => $row->max_price ? round((float) $row->max_price, 2) : null,
            'recent' => $recent->map(fn ($r) => [
                'reference' => $r->reference,
                'date' => $r->sale_date,
                'unit_price_m2_mad' => round((float) $r->unit_price, 2),
                'quantity_m2' => round((float) $r->quantity_m2, 2),
            ])->all(),
        ];
    }

    /** @return array<string, mixed>|null */
    private function clientStatsForFabric(int $clientId, int $fabricTypeId): ?array
    {
        $row = DB::table('sale_items')
            ->join('fabric_rolls', 'sale_items.fabric_roll_id', '=', 'fabric_rolls.id')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('sales.client_id', $clientId)
            ->where('fabric_rolls.fabric_type_id', $fabricTypeId)
            ->selectRaw('COUNT(*) as sales_count')
            ->selectRaw('AVG(sale_items.unit_price) as avg_price')
            ->selectRaw('MAX(sales.sale_date) as last_sale_date')
            ->first();

        if (! $row || (int) $row->sales_count === 0) {
            return null;
        }

        return [
            'sales_count' => (int) $row->sales_count,
            'avg_price_m2_mad' => $row->avg_price ? round((float) $row->avg_price, 2) : null,
            'last_sale_date' => $row->last_sale_date,
        ];
    }
}
