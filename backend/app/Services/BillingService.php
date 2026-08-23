<?php

namespace App\Services;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Sale;
use InvalidArgumentException;

class BillingService
{
    public const DEFAULT_TAX_RATE = 20.0;

    /** @var array<int, array<int, float>> */
    private array $fifoCache = [];

    /** @var array<int, array<int, float>> */
    private array $fifoSalesCache = [];

    public function defaultTaxRate(): float
    {
        return (float) (config('company.tax_rate') ?? self::DEFAULT_TAX_RATE);
    }

    /**
     * Split a TTC amount into HT, TVA and TTC (amounts are tax-inclusive).
     *
     * @return array{subtotal: float, tax_rate: float, tax_amount: float, total: float}
     */
    public function splitTtc(float $amountTtc, ?float $taxRate = null): array
    {
        $taxRate ??= $this->defaultTaxRate();
        $amountTtc = round(max(0, $amountTtc), 2);
        $ht = round($amountTtc / (1 + ($taxRate / 100)), 2);
        $tax = round($amountTtc - $ht, 2);

        return [
            'subtotal' => $ht,
            'tax_rate' => $taxRate,
            'tax_amount' => $tax,
            'total' => $amountTtc,
        ];
    }

    public function htFromTtc(float $amountTtc, ?float $taxRate = null): float
    {
        return $this->splitTtc($amountTtc, $taxRate)['subtotal'];
    }

    public function createInvoiceForSale(Sale $sale, ?float $amountTtc = null): Invoice
    {
        $client = $sale->client;
        $amountTtc = $amountTtc ?? $sale->remainingToInvoice();

        if ($amountTtc <= 0) {
            throw new InvalidArgumentException('Aucun montant restant à facturer pour cette vente.');
        }

        if ($amountTtc > $sale->remainingToInvoice() + 0.01) {
            throw new InvalidArgumentException('Le montant dépasse le reste à facturer sur cette vente.');
        }

        $breakdown = $this->splitTtc($amountTtc);

        return Invoice::create([
            'sale_id' => $sale->id,
            'client_id' => $sale->client_id,
            'reference' => $this->nextInvoiceReference(),
            'invoice_date' => $sale->sale_date,
            'due_date' => $sale->sale_date->copy()->addDays($client->payment_terms_days ?? 30),
            'subtotal' => $breakdown['subtotal'],
            'tax_rate' => $breakdown['tax_rate'],
            'tax_amount' => $breakdown['tax_amount'],
            'total' => $breakdown['total'],
            'status' => 'sent',
        ]);
    }

    /**
     * Allocate confirmed untargeted payments to stock sales only (oldest unpaid first).
     * Payments with sale_id (targeted) are excluded from automatic allocation.
     *
     * @return array<int, float> sale_id => allocated amount
     */
    public function fifoStockSaleAllocations(Client $client, bool $refresh = false): array
    {
        if (! $refresh && isset($this->fifoSalesCache[$client->id])) {
            return $this->fifoSalesCache[$client->id];
        }

        $payments = Payment::query()
            ->where('client_id', $client->id)
            ->where('status', 'confirmed')
            ->whereNull('sale_id')
            ->orderBy('payment_date')
            ->orderBy('id')
            ->get();

        $sales = Sale::query()
            ->where('client_id', $client->id)
            ->where(function ($q) {
                $q->where('sale_type', 'stock')->orWhereNull('sale_type');
            })
            ->orderBy('sale_date')
            ->orderBy('id')
            ->get();

        $allocations = [];
        $remainingBySale = [];

        foreach ($sales as $sale) {
            $allocations[$sale->id] = 0.0;
            $remainingBySale[$sale->id] = (float) $sale->total_amount;
        }

        foreach ($payments as $payment) {
            $left = (float) $payment->amount;

            foreach ($sales as $sale) {
                if ($left <= 0.001) {
                    break;
                }

                $canApply = min($left, $remainingBySale[$sale->id]);

                if ($canApply <= 0) {
                    continue;
                }

                $allocations[$sale->id] += $canApply;
                $remainingBySale[$sale->id] -= $canApply;
                $left -= $canApply;
            }
        }

        foreach ($allocations as $saleId => $amount) {
            $allocations[$saleId] = round($amount, 2);
        }

        $this->fifoSalesCache[$client->id] = $allocations;

        return $allocations;
    }

    public function creditPaidAmount(Sale $sale): float
    {
        if ($sale->sale_type !== 'legacy_credit') {
            return 0.0;
        }

        return round((float) Payment::query()
            ->where('sale_id', $sale->id)
            ->where('status', 'confirmed')
            ->sum('amount'), 2);
    }

    public function targetedPaidAmount(Sale $sale): float
    {
        return round((float) Payment::query()
            ->where('sale_id', $sale->id)
            ->where('status', 'confirmed')
            ->sum('amount'), 2);
    }

    public function salePaidAmount(Sale $sale, ?array $allocations = null): float
    {
        if ($sale->sale_type === 'legacy_credit') {
            return $this->creditPaidAmount($sale);
        }

        $allocations ??= $this->fifoStockSaleAllocations($sale->client);
        $fifo = (float) ($allocations[$sale->id] ?? 0);

        return round($fifo + $this->targetedPaidAmount($sale), 2);
    }

    public function saleBalanceDue(Sale $sale, ?array $allocations = null): float
    {
        return round(max(0, (float) $sale->total_amount - $this->salePaidAmount($sale, $allocations)), 2);
    }

    /**
     * Allocate confirmed payments to invoices.
     * Credit-targeted payments (sale_id set) go only to that sale's invoices first;
     * untagged payments FIFO across remaining invoice balances.
     *
     * @return array<int, float> invoice_id => allocated amount
     */
    public function fifoInvoiceAllocations(Client $client, bool $refresh = false): array
    {
        if (! $refresh && isset($this->fifoCache[$client->id])) {
            return $this->fifoCache[$client->id];
        }

        $payments = Payment::query()
            ->where('client_id', $client->id)
            ->where('status', 'confirmed')
            ->orderBy('payment_date')
            ->orderBy('id')
            ->get();

        $invoices = Invoice::query()
            ->where('client_id', $client->id)
            ->orderBy('invoice_date')
            ->orderBy('id')
            ->get();

        $allocations = [];
        $remainingByInvoice = [];
        $invoicesBySale = [];

        foreach ($invoices as $invoice) {
            $allocations[$invoice->id] = 0.0;
            $remainingByInvoice[$invoice->id] = (float) $invoice->total;
            $invoicesBySale[$invoice->sale_id][] = $invoice;
        }

        foreach ($payments->whereNotNull('sale_id') as $payment) {
            $left = (float) $payment->amount;
            $saleInvoices = $invoicesBySale[$payment->sale_id] ?? [];

            foreach ($saleInvoices as $invoice) {
                if ($left <= 0.001) {
                    break;
                }

                $canApply = min($left, $remainingByInvoice[$invoice->id]);

                if ($canApply <= 0) {
                    continue;
                }

                $allocations[$invoice->id] += $canApply;
                $remainingByInvoice[$invoice->id] -= $canApply;
                $left -= $canApply;
            }
        }

        foreach ($payments->whereNull('sale_id') as $payment) {
            $left = (float) $payment->amount;

            foreach ($invoices as $invoice) {
                if ($left <= 0.001) {
                    break;
                }

                $canApply = min($left, $remainingByInvoice[$invoice->id]);

                if ($canApply <= 0) {
                    continue;
                }

                $allocations[$invoice->id] += $canApply;
                $remainingByInvoice[$invoice->id] -= $canApply;
                $left -= $canApply;
            }
        }

        foreach ($allocations as $invoiceId => $amount) {
            $allocations[$invoiceId] = round($amount, 2);
        }

        $this->fifoCache[$client->id] = $allocations;

        return $allocations;
    }

    public function invoicePaidAmount(Invoice $invoice, ?array $allocations = null): float
    {
        $allocations ??= $this->fifoInvoiceAllocations($invoice->client);

        return round((float) ($allocations[$invoice->id] ?? 0), 2);
    }

    public function invoiceRemainingToPay(Invoice $invoice, ?array $allocations = null): float
    {
        return round(max(0, (float) $invoice->total - $this->invoicePaidAmount($invoice, $allocations)), 2);
    }

    public function applyPayment(Payment $payment): void
    {
        if ($payment->status !== 'confirmed') {
            return;
        }

        $client = $payment->client ?? Client::find($payment->client_id);

        if (! $client) {
            return;
        }

        $this->syncClientBilling($client);
    }

    public function syncClientBilling(Client $client): void
    {
        unset($this->fifoCache[$client->id], $this->fifoSalesCache[$client->id]);

        $invoiceAllocations = $this->fifoInvoiceAllocations($client, true);
        $saleAllocations = $this->fifoStockSaleAllocations($client, true);

        $invoices = Invoice::query()->where('client_id', $client->id)->get();

        foreach ($invoices as $invoice) {
            $this->syncInvoiceStatus($invoice, $invoiceAllocations);
        }

        $sales = Sale::query()->where('client_id', $client->id)->get();

        foreach ($sales as $sale) {
            $paid = $this->salePaidAmount($sale, $saleAllocations);
            $total = (float) $sale->total_amount;
            $status = match (true) {
                $paid <= 0 => 'unpaid',
                $paid < $total - 0.01 => 'partial',
                default => 'paid',
            };

            $sale->update([
                'paid_amount' => $paid,
                'payment_status' => $status,
            ]);
        }
    }

    public function syncInvoiceStatus(Invoice $invoice, ?array $allocations = null): void
    {
        $paid = $this->invoicePaidAmount($invoice, $allocations);
        $total = (float) $invoice->total;

        $status = match (true) {
            $paid >= $total - 0.01 => 'paid',
            $paid > 0.01 => 'partial',
            default => 'unpaid',
        };

        if ($invoice->status !== $status) {
            $invoice->update(['status' => $status]);
        }
    }

    public function syncSaleFromInvoices(?Sale $sale, ?array $allocations = null): void
    {
        if (! $sale) {
            return;
        }

        $sale->loadMissing('invoices', 'client');

        $paid = 0.0;

        foreach ($sale->invoices as $invoice) {
            $paid += $this->invoicePaidAmount($invoice, $allocations);
        }

        $total = (float) $sale->total_amount;
        $status = match (true) {
            $paid <= 0 => 'unpaid',
            $paid < $total - 0.01 => 'partial',
            default => 'paid',
        };

        $sale->update([
            'paid_amount' => round($paid, 2),
            'payment_status' => $status,
        ]);
    }

    public function validateClientPaymentAmount(Client $client, float $amount, ?Sale $sale = null): void
    {
        if ($amount <= 0) {
            throw new InvalidArgumentException('Le montant doit être supérieur à zéro.');
        }

        if ($sale) {
            if ($sale->client_id !== $client->id) {
                throw new InvalidArgumentException('Cette vente n\'appartient pas à ce client.');
            }

            $due = $this->saleBalanceDue($sale);
            $label = $sale->sale_type === 'legacy_credit' ? 'ce crédit' : 'cette vente';

            if ($amount > $due + 0.01) {
                throw new InvalidArgumentException(
                    "Le montant dépasse le solde dû sur {$label} ({$due} MAD)."
                );
            }

            return;
        }

        $balance = $this->clientBalance($client);

        if ($amount > $balance['sales_balance_due'] + 0.01) {
            throw new InvalidArgumentException(
                "Le montant dépasse le solde dû sur les ventes ({$balance['sales_balance_due']} MAD)."
            );
        }
    }

    /** @deprecated Use validateClientPaymentAmount() */
    public function validatePaymentAmount(Invoice $invoice, float $amount): void
    {
        $this->validateClientPaymentAmount($invoice->client, $amount);
    }

    public function clientBalance(Client $client): array
    {
        $totalInvoiced = (float) $client->invoices()->sum('total');
        $totalPaid = (float) Payment::query()
            ->where('client_id', $client->id)
            ->where('status', 'confirmed')
            ->sum('amount');

        $totalStockSales = (float) $client->sales()
            ->where(function ($q) {
                $q->where('sale_type', 'stock')->orWhereNull('sale_type');
            })
            ->sum('total_amount');

        $totalCredits = (float) $client->sales()
            ->where('sale_type', 'legacy_credit')
            ->sum('total_amount');

        $saleAllocations = $this->fifoStockSaleAllocations($client);
        $paidOnStockFifo = round(array_sum($saleAllocations), 2);

        $paidOnStockTargeted = round((float) Payment::query()
            ->where('client_id', $client->id)
            ->where('status', 'confirmed')
            ->whereNotNull('sale_id')
            ->whereHas('sale', fn ($q) => $q->where(function ($q2) {
                $q2->where('sale_type', 'stock')->orWhereNull('sale_type');
            }))
            ->sum('amount'), 2);

        $paidOnStockSales = round($paidOnStockFifo + $paidOnStockTargeted, 2);

        $paidOnCredits = round((float) Payment::query()
            ->where('client_id', $client->id)
            ->where('status', 'confirmed')
            ->whereNotNull('sale_id')
            ->whereHas('sale', fn ($q) => $q->where('sale_type', 'legacy_credit'))
            ->sum('amount'), 2);

        $salesBalanceDue = round(max(0, $totalStockSales - $paidOnStockSales), 2);
        $creditsBalanceDue = round(max(0, $totalCredits - $paidOnCredits), 2);

        return [
            'total_invoiced' => round($totalInvoiced, 2),
            'total_stock_sales' => round($totalStockSales, 2),
            'total_credits' => round($totalCredits, 2),
            'total_sales' => round($totalStockSales + $totalCredits, 2),
            'total_paid' => round($totalPaid, 2),
            'sales_balance_due' => $salesBalanceDue,
            'credits_balance_due' => $creditsBalanceDue,
            'balance_due' => round($salesBalanceDue + $creditsBalanceDue, 2),
            'orders_count' => $client->sales()->where(function ($q) {
                $q->where('sale_type', 'stock')->orWhereNull('sale_type');
            })->count(),
            'credits_count' => $client->sales()->where('sale_type', 'legacy_credit')->count(),
        ];
    }

    /**
     * @param  iterable<int, Client>  $clients
     * @return array<int, array{orders_count: int, total_sales: float, balance_due: float}>
     */
    public function clientListStats(iterable $clients): array
    {
        $ids = collect($clients)->pluck('id')->filter()->values()->all();

        if ($ids === []) {
            return [];
        }

        $salesRows = Sale::query()
            ->whereIn('client_id', $ids)
            ->where(function ($q) {
                $q->where('sale_type', 'stock')->orWhereNull('sale_type');
            })
            ->selectRaw('client_id')
            ->selectRaw('COUNT(*) as orders_count')
            ->selectRaw('COALESCE(SUM(total_amount), 0) as total_stock_sales')
            ->groupBy('client_id')
            ->get()
            ->keyBy('client_id');

        $creditRows = Sale::query()
            ->whereIn('client_id', $ids)
            ->where('sale_type', 'legacy_credit')
            ->selectRaw('client_id')
            ->selectRaw('COALESCE(SUM(total_amount), 0) as total_credits')
            ->groupBy('client_id')
            ->get()
            ->keyBy('client_id');

        $paidRows = Payment::query()
            ->whereIn('client_id', $ids)
            ->where('status', 'confirmed')
            ->whereNull('sale_id')
            ->selectRaw('client_id')
            ->selectRaw('COALESCE(SUM(amount), 0) as total_paid_sales')
            ->groupBy('client_id')
            ->get()
            ->keyBy('client_id');

        $paidCreditRows = Payment::query()
            ->whereIn('client_id', $ids)
            ->where('status', 'confirmed')
            ->whereNotNull('sale_id')
            ->whereHas('sale', fn ($q) => $q->where('sale_type', 'legacy_credit'))
            ->selectRaw('client_id')
            ->selectRaw('COALESCE(SUM(amount), 0) as total_paid_credits')
            ->groupBy('client_id')
            ->get()
            ->keyBy('client_id');

        $stats = [];

        foreach ($ids as $id) {
            $sales = $salesRows->get($id);
            $stockTotal = (float) ($sales->total_stock_sales ?? 0);
            $creditsTotal = (float) ($creditRows->get($id)?->total_credits ?? 0);
            $paidSales = (float) ($paidRows->get($id)?->total_paid_sales ?? 0);
            $paidCredits = (float) ($paidCreditRows->get($id)?->total_paid_credits ?? 0);
            $salesBalanceDue = round(max(0, $stockTotal - $paidSales), 2);
            $creditsBalanceDue = round(max(0, $creditsTotal - $paidCredits), 2);

            $stats[$id] = [
                'orders_count' => (int) ($sales->orders_count ?? 0),
                'total_sales' => round($stockTotal + $creditsTotal, 2),
                'total_stock_sales' => round($stockTotal, 2),
                'total_credits' => round($creditsTotal, 2),
                'balance_due' => round($salesBalanceDue + $creditsBalanceDue, 2),
                'sales_balance_due' => $salesBalanceDue,
                'credits_balance_due' => $creditsBalanceDue,
            ];
        }

        return $stats;
    }

    private function nextInvoiceReference(): string
    {
        $year = now()->format('Y');
        $last = Invoice::where('reference', 'like', "FAC-{$year}-%")
            ->orderByDesc('reference')
            ->value('reference');

        $seq = $last ? ((int) substr($last, -4)) + 1 : 1;

        return sprintf('FAC-%s-%04d', $year, $seq);
    }
}
