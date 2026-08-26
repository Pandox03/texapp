<?php

namespace App\Services;

use App\Models\Client;
use App\Models\Container;
use App\Models\FabricType;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Sale;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    private const LOW_STOCK_M2 = 500;

    private const LOW_STOCK_KG = 200;

    public function __construct(
        private BillingService $billing,
        private StockService $stock,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(): array
    {
        $now = now();
        $startOfMonth = $now->copy()->startOfMonth();
        $startOfLastMonth = $now->copy()->subMonth()->startOfMonth();
        $endOfLastMonth = $now->copy()->subMonth()->endOfMonth();

        $globalSummary = $this->stock->globalSummary();
        $receivables = $this->receivables();

        $confirmedPayments = Payment::query()->where('status', 'confirmed');

        $revenueThisMonth = (float) (clone $confirmedPayments)
            ->where('payment_date', '>=', $startOfMonth)
            ->sum('amount');
        $revenueLastMonth = (float) (clone $confirmedPayments)
            ->whereBetween('payment_date', [$startOfLastMonth, $endOfLastMonth])
            ->sum('amount');

        $salesChart = $this->salesChart($now);
        $chartValues = $salesChart->pluck('revenue')->filter(fn ($v) => $v > 0);
        $threeMonthAvg = $chartValues->count() > 0
            ? round($chartValues->avg(), 2)
            : 0;

        $revenueGrowth = $revenueLastMonth > 0
            ? round((($revenueThisMonth - $revenueLastMonth) / $revenueLastMonth) * 100, 1)
            : ($revenueThisMonth > 0 ? 100 : 0);

        $totalPaid = round((float) (clone $confirmedPayments)->sum('amount'), 2);
        $totalInvoiced = round((float) Invoice::sum('total'), 2);

        $actions = $this->priorityActions($now);

        return [
            'stats' => [
                'containers' => Container::count(),
                'clients' => Client::count(),
                'total_stock_m2' => $globalSummary['total_m2'],
                'sold_m2' => $globalSummary['sold_m2'],
                'available_m2' => $globalSummary['available_m2'],
                'available_rolls' => $globalSummary['available_rolls'],
                'total_revenue' => $totalPaid,
                'revenue_this_month' => round($revenueThisMonth, 2),
                'revenue_last_month' => round($revenueLastMonth, 2),
                'revenue_growth' => $revenueGrowth,
                'revenue_three_month_avg' => $threeMonthAvg,
                'total_paid' => $totalPaid,
                'total_invoiced' => $totalInvoiced,
                'balance_due' => $receivables['total'],
                'sales_count' => Sale::count(),
                'sales_this_month' => Sale::where('sale_date', '>=', $startOfMonth)->count(),
                'unpaid_invoices_count' => Invoice::whereIn('status', ['unpaid', 'sent'])
                    ->get()
                    ->filter(fn (Invoice $i) => $i->remainingToPay() > 0.01)
                    ->count(),
            ],
            'receivables' => $receivables,
            'priority_actions' => $actions,
            'sales_chart' => $salesChart,
            'stock_by_type' => $this->stockByType(),
            'top_clients' => $this->topClients(),
            'container_status' => Container::query()
                ->select('status', DB::raw('COUNT(*) as count'))
                ->groupBy('status')
                ->pluck('count', 'status'),
            'payment_breakdown' => Invoice::query()
                ->select('status', DB::raw('COUNT(*) as count'), DB::raw('SUM(total) as amount'))
                ->groupBy('status')
                ->get()
                ->mapWithKeys(fn ($row) => [
                    $row->status => [
                        'count' => (int) $row->count,
                        'amount' => round((float) $row->amount, 2),
                    ],
                ]),
            'invoice_stats' => [
                'total' => Invoice::count(),
                'paid' => Invoice::where('status', 'paid')->count(),
                'unpaid' => Invoice::where('status', 'unpaid')->count(),
                'sent' => Invoice::where('status', 'sent')->count(),
                'total_amount' => $totalInvoiced,
            ],
            'low_stock' => $this->lowStockAlerts(),
            'recent_containers' => $this->recentContainers(),
            'recent_sales' => Sale::with(['client', 'invoice'])
                ->latest('sale_date')
                ->limit(6)
                ->get(),
            'recent_payments' => Payment::with(['client', 'invoice'])
                ->where('status', 'confirmed')
                ->latest('payment_date')
                ->limit(5)
                ->get(),
            'unpaid_invoices' => Invoice::with('client')
                ->whereIn('status', ['unpaid', 'sent'])
                ->orderBy('due_date')
                ->get()
                ->filter(fn (Invoice $i) => $i->remainingToPay() > 0.01)
                ->take(5)
                ->map(fn (Invoice $i) => array_merge($i->toArray(), [
                    'remaining' => $i->remainingToPay(),
                    'days_overdue' => $i->due_date && $i->due_date->isPast()
                        ? (int) $i->due_date->diffInDays($now)
                        : 0,
                ]))
                ->values(),
        ];
    }

    /**
     * Créances = somme par client de (total facturé − total encaissé).
     *
     * @return array{total: float, by_client: list<array<string, mixed>>}
     */
    private function receivables(): array
    {
        $byClient = [];
        $total = 0.0;

        $clients = Client::query()
            ->whereHas('invoices')
            ->orderBy('name')
            ->get();

        foreach ($clients as $client) {
            $balance = $this->billing->clientBalance($client);

            if ($balance['balance_due'] <= 0.01) {
                continue;
            }

            $total += $balance['balance_due'];
            $byClient[] = [
                'id' => $client->id,
                'name' => $client->name,
                'city' => $client->city,
                'invoiced' => $balance['total_invoiced'],
                'paid' => $balance['total_paid'],
                'balance_due' => $balance['balance_due'],
            ];
        }

        usort($byClient, fn ($a, $b) => $b['balance_due'] <=> $a['balance_due']);

        return [
            'total' => round($total, 2),
            'by_client' => array_values($byClient),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function priorityActions(Carbon $now): array
    {
        $actions = [];

        $overdueInvoices = Invoice::with('client')
            ->whereIn('status', ['unpaid', 'sent'])
            ->whereDate('due_date', '<', $now->toDateString())
            ->orderBy('due_date')
            ->get()
            ->filter(fn (Invoice $i) => $i->remainingToPay() > 0.01);

        foreach ($overdueInvoices->take(5) as $invoice) {
            $days = (int) $invoice->due_date->diffInDays($now);
            $actions[] = [
                'type' => 'overdue_invoice',
                'severity' => $days > 30 ? 'high' : 'medium',
                'label' => "{$invoice->reference} — {$invoice->client?->name}",
                'detail' => "Retard de {$days} j · ".number_format($invoice->remainingToPay(), 2, ',', ' ').' MAD',
                'amount' => $invoice->remainingToPay(),
                'link' => '/invoices?status=unpaid',
                'entity_id' => $invoice->id,
            ];
        }

        foreach (array_slice($this->lowStockAlerts(), 0, 3) as $line) {
            $unitLabel = \App\Support\QuantityUnit::label($line['unit'] ?? null);
            $actions[] = [
                'type' => 'low_stock',
                'severity' => $line['available_m2'] < ($line['unit'] === 'kg' ? 50 : 100) ? 'high' : 'medium',
                'label' => $line['fabric_type'],
                'detail' => "Il reste {$line['available_rolls']} rouleau(x) · {$line['available_m2']} {$unitLabel} disponibles",
                'amount' => null,
                'link' => '/stock',
                'entity_id' => $line['fabric_type_id'],
            ];
        }

        $staleContainers = Container::query()
            ->where('status', 'in_transit')
            ->whereDate('arrival_date', '<', $now->toDateString())
            ->orderBy('arrival_date')
            ->limit(3)
            ->get();

        foreach ($staleContainers as $container) {
            $days = (int) $container->arrival_date->diffInDays($now);
            $actions[] = [
                'type' => 'stale_container',
                'severity' => 'medium',
                'label' => $container->reference,
                'detail' => "En transit depuis {$days} j (arrivée prévue {$container->arrival_date->format('d/m/Y')})",
                'amount' => null,
                'link' => "/containers/{$container->id}",
                'entity_id' => $container->id,
            ];
        }

        return $actions;
    }

    /**
     * @return \Illuminate\Support\Collection<int, array<string, mixed>>
     */
    private function salesChart(Carbon $now)
    {
        $driver = DB::connection()->getDriverName();
        $monthExpr = $driver === 'mysql'
            ? "DATE_FORMAT(payment_date, '%Y-%m')"
            : "strftime('%Y-%m', payment_date)";

        $paymentsByMonth = Payment::query()
            ->where('status', 'confirmed')
            ->select(
                DB::raw("{$monthExpr} as month"),
                DB::raw('SUM(amount) as revenue'),
                DB::raw('COUNT(*) as count')
            )
            ->where('payment_date', '>=', $now->copy()->subMonths(5)->startOfMonth())
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        $monthLabels = collect();
        for ($i = 5; $i >= 0; $i--) {
            $monthLabels->push($now->copy()->subMonths($i)->format('Y-m'));
        }

        return $monthLabels->map(function ($month) use ($paymentsByMonth) {
            $row = $paymentsByMonth->get($month);
            $revenue = round((float) ($row->revenue ?? 0), 2);

            return [
                'month' => $month,
                'label' => Carbon::createFromFormat('Y-m', $month)->locale('fr')->translatedFormat('M Y'),
                'revenue' => $revenue,
                'count' => (int) ($row->count ?? 0),
                'has_data' => $revenue > 0,
            ];
        });
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function stockByType(): array
    {
        $lines = $this->stock->globalStockLines();

        $byType = [];
        foreach ($lines as $line) {
            $typeId = $line['fabric_type_id'];
            if (! isset($byType[$typeId])) {
                $byType[$typeId] = [
                    'fabric_type_id' => $typeId,
                    'name' => FabricType::find($typeId)?->name ?? 'Tissu',
                    'unit' => $line['unit'] ?? 'm2',
                    'total_m2' => 0.0,
                    'available_m2' => 0.0,
                    'sold_m2' => 0.0,
                ];
            }
            $byType[$typeId]['total_m2'] += $line['total_m2'];
            $byType[$typeId]['available_m2'] += $line['available_m2'];
            $byType[$typeId]['sold_m2'] += $line['sold_m2'];
        }

        $result = collect($byType)
            ->map(function ($row) {
                $threshold = ($row['unit'] ?? 'm2') === 'kg' ? self::LOW_STOCK_KG : self::LOW_STOCK_M2;
                $row['total_m2'] = round($row['total_m2'], 2);
                $row['available_m2'] = round($row['available_m2'], 2);
                $row['sold_m2'] = round($row['sold_m2'], 2);
                $row['is_low'] = $row['available_m2'] < $threshold;
                $row['usage_pct'] = $row['total_m2'] > 0
                    ? round(($row['sold_m2'] / $row['total_m2']) * 100, 1)
                    : 0;

                return $row;
            })
            ->sortByDesc('available_m2')
            ->take(6)
            ->values()
            ->all();

        return $result;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function lowStockAlerts(): array
    {
        return collect($this->stock->globalStockLines())
            ->filter(function ($line) {
                $threshold = ($line['unit'] ?? 'm2') === 'kg' ? self::LOW_STOCK_KG : self::LOW_STOCK_M2;

                return $line['available_m2'] > 0 && $line['available_m2'] < $threshold;
            })
            ->map(function ($line) {
                $fabricType = FabricType::find($line['fabric_type_id']);

                return [
                    'fabric_type_id' => $line['fabric_type_id'],
                    'fabric_type' => $fabricType?->name ?? 'Tissu',
                    'unit' => $line['unit'] ?? 'm2',
                    'available_m2' => $line['available_m2'],
                    'available_rolls' => $line['available_rolls'],
                    'total_m2' => $line['total_m2'],
                    'ratio' => $line['total_m2'] > 0
                        ? round(($line['available_m2'] / $line['total_m2']) * 100, 1)
                        : 0,
                ];
            })
            ->sortBy('available_m2')
            ->take(8)
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function recentContainers(): array
    {
        return Container::query()
            ->withCount('items')
            ->with(['items.fabricType'])
            ->latest('arrival_date')
            ->limit(5)
            ->get()
            ->map(function (Container $container) {
                $linesCount = $container->items_count ?? $container->items->count();
                $totalM2 = round((float) $container->items->sum('quantity_m2'), 2);

                return array_merge($container->toArray(), [
                    'items_count' => $linesCount,
                    'stock_summary' => [
                        'lines_count' => $linesCount,
                        'total_m2' => $totalM2,
                    ],
                ]);
            })
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function topClients(): array
    {
        $now = now();

        $lastSales = Sale::query()
            ->selectRaw('client_id, MAX(sale_date) as last_sale_date')
            ->groupBy('client_id')
            ->pluck('last_sale_date', 'client_id');

        return Client::query()
            ->select('clients.id', 'clients.name', 'clients.city')
            ->join('payments', 'payments.client_id', '=', 'clients.id')
            ->where('payments.status', 'confirmed')
            ->groupBy('clients.id', 'clients.name', 'clients.city')
            ->selectRaw('COALESCE(SUM(payments.amount), 0) as revenue')
            ->selectRaw('COUNT(payments.id) as payments_count')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get()
            ->map(function ($c) use ($now, $lastSales) {
                $lastSaleRaw = $lastSales->get($c->id);
                $lastSale = $lastSaleRaw ? Carbon::parse($lastSaleRaw) : null;
                $daysSince = $lastSale ? (int) $lastSale->diffInDays($now) : null;

                return [
                    'id' => $c->id,
                    'name' => $c->name,
                    'city' => $c->city,
                    'revenue' => round((float) $c->revenue, 2),
                    'orders_count' => (int) $c->payments_count,
                    'last_sale_date' => $lastSale?->toDateString(),
                    'days_since_last_order' => $daysSince,
                    'is_inactive' => $daysSince !== null && $daysSince > 60,
                ];
            })
            ->all();
    }
}
