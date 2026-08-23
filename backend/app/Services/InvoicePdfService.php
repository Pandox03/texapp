<?php

namespace App\Services;

use App\Models\Invoice;
use App\Support\FrenchAmountInWords;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as DomPdf;

class InvoicePdfService
{
    public function __construct(
        private BrandAssetService $brand,
        private BillingService $billing,
        private CompanySettingsService $companySettings,
    ) {}

    public function generate(Invoice $invoice): DomPdf
    {
        $invoice->load([
            'client',
            'sale.items.fabricType',
            'sale.items.fabricRoll.fabricType',
        ]);

        $sale = $invoice->sale;
        $saleTotalTtc = (float) $sale->total_amount;
        $isPartial = abs((float) $invoice->total - $saleTotalTtc) > 0.01;
        $saleLines = $this->buildSaleLineGroups($invoice);

        return Pdf::loadView('invoices.pdf', [
            'invoice' => $invoice,
            'company' => $this->companySettings->config(),
            'logoDataUri' => $this->brand->logoDataUri(),
            'logoHeaderDataUri' => $this->brand->logoHeaderDataUri(),
            'amountInWords' => FrenchAmountInWords::format((float) $invoice->total),
            'saleSummary' => [
                'reference' => $sale->reference,
                'date' => $sale->sale_date,
                'total_ttc' => $saleTotalTtc,
                'rolls_count' => $sale->items->count(),
                'total_m2' => round((float) $sale->items->sum('quantity_m2'), 2),
                'notes' => $sale->notes,
                'is_partial' => $isPartial,
            ],
            'saleLines' => $saleLines,
        ])->setPaper('a4');
    }

    /**
     * Build invoice lines grouped by fabric type.
     * HT amounts are allocated from the invoice subtotal so the table
     * always matches the footer (Sous-total HT / TVA / Total TTC).
     *
     * @return array<int, array{
     *     fabric: string,
     *     roll_count: int,
     *     quantity_m2: float,
     *     unit_price: float,
     *     line_total: float
     * }>
     */
    private function buildSaleLineGroups(Invoice $invoice): array
    {
        /** @var array<int, array{fabric: string, roll_count: int, quantity_m2: float, line_total_ttc: float}> $groups */
        $groups = [];

        foreach ($invoice->sale->items as $item) {
            $typeId = (int) ($item->fabric_type_id ?? $item->fabricRoll?->fabric_type_id ?? 0);
            $fabric = $item->fabricType?->name
                ?? $item->fabricRoll?->fabricType?->name
                ?? ($invoice->sale->sale_type === 'legacy_credit' ? 'Crédit client (historique)' : 'Tissu');

            if (! isset($groups[$typeId])) {
                $groups[$typeId] = [
                    'fabric' => $fabric,
                    'roll_count' => 0,
                    'quantity_m2' => 0.0,
                    'line_total_ttc' => 0.0,
                ];
            }

            if ($item->fabric_roll_id) {
                $groups[$typeId]['roll_count']++;
            }
            $groups[$typeId]['quantity_m2'] += (float) $item->quantity_m2;
            $groups[$typeId]['line_total_ttc'] += (float) $item->line_total;
        }

        $groupList = array_values($groups);
        $invoiceSubtotalHt = round((float) $invoice->subtotal, 2);
        $saleTotalTtc = max(0.01, round((float) $invoice->sale->total_amount, 2));
        $assignedHt = 0.0;
        $lines = [];

        foreach ($groupList as $index => $group) {
            $isLast = $index === count($groupList) - 1;
            $lineHt = $isLast
                ? round($invoiceSubtotalHt - $assignedHt, 2)
                : round($invoiceSubtotalHt * ($group['line_total_ttc'] / $saleTotalTtc), 2);

            if (! $isLast) {
                $assignedHt += $lineHt;
            }

            $qty = max(0.01, $group['quantity_m2']);

            $lines[] = [
                'fabric' => $group['fabric'],
                'roll_count' => $group['roll_count'],
                'quantity_m2' => round($group['quantity_m2'], 2),
                'unit_price' => round($lineHt / $qty, 2),
                'line_total' => $lineHt,
            ];
        }

        return $lines;
    }
}
