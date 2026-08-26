<?php

namespace App\Services;

use App\Models\Client;
use App\Models\Payment;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as DomPdf;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ClientStatementService
{
    public function __construct(
        private BillingService $billing,
        private BrandAssetService $brand,
        private CompanySettingsService $companySettings,
    ) {}

    /**
     * @return array{
     *     client: Client,
     *     company: array<string, mixed>,
     *     generated_at: string,
     *     balance: array<string, float|int>,
     *     lines: list<array{
     *         date: string,
     *         reference: string,
     *         description: string,
     *         type: string,
     *         debit: float,
     *         credit: float,
     *         balance: float
     *     }>,
     *     totals: array{debit: float, credit: float, balance: float}
     * }
     */
    public function build(Client $client): array
    {
        $client->loadMissing([]);

        $sales = $client->sales()
            ->orderBy('sale_date')
            ->orderBy('id')
            ->get(['id', 'reference', 'sale_date', 'sale_type', 'total_amount', 'notes']);

        $payments = $client->payments()
            ->with(['invoice:id,reference', 'sale:id,reference,sale_type'])
            ->where('status', 'confirmed')
            ->orderBy('payment_date')
            ->orderBy('id')
            ->get();

        /** @var Collection<int, array{sort_date: string, sort_key: int, date: string, reference: string, description: string, type: string, debit: float, credit: float}> $events */
        $events = collect();

        foreach ($sales as $sale) {
            $isCredit = $sale->sale_type === 'legacy_credit';
            $events->push([
                'sort_date' => (string) $sale->sale_date,
                'sort_key' => (int) $sale->id,
                'date' => (string) $sale->sale_date,
                'reference' => (string) $sale->reference,
                'description' => $isCredit
                    ? 'Crédit client'
                    : 'Vente / commande',
                'type' => $isCredit ? 'credit_sale' : 'sale',
                'debit' => round((float) $sale->total_amount, 2),
                'credit' => 0.0,
            ]);
        }

        foreach ($payments as $payment) {
            $events->push([
                'sort_date' => (string) $payment->payment_date,
                'sort_key' => 1_000_000 + (int) $payment->id,
                'date' => (string) $payment->payment_date,
                'reference' => (string) $payment->reference,
                'description' => $this->paymentDescription($payment),
                'type' => 'payment',
                'debit' => 0.0,
                'credit' => round((float) $payment->amount, 2),
            ]);
        }

        $sorted = $events
            ->sortBy([
                ['sort_date', 'asc'],
                ['sort_key', 'asc'],
            ])
            ->values();

        $running = 0.0;
        $lines = [];
        $totalDebit = 0.0;
        $totalCredit = 0.0;

        foreach ($sorted as $event) {
            $running = round($running + $event['debit'] - $event['credit'], 2);
            $totalDebit = round($totalDebit + $event['debit'], 2);
            $totalCredit = round($totalCredit + $event['credit'], 2);

            $lines[] = [
                'date' => $event['date'],
                'reference' => $event['reference'],
                'description' => $event['description'],
                'type' => $event['type'],
                'debit' => $event['debit'],
                'credit' => $event['credit'],
                'balance' => $running,
            ];
        }

        $balance = $this->billing->clientBalance($client);

        return [
            'client' => $client,
            'company' => $this->companySettings->config(),
            'generated_at' => now()->timezone(config('app.timezone', 'Africa/Casablanca'))->format('d/m/Y H:i'),
            'balance' => $balance,
            'lines' => $lines,
            'totals' => [
                'debit' => $totalDebit,
                'credit' => $totalCredit,
                'balance' => round($running, 2),
            ],
        ];
    }

    public function generatePdf(Client $client): DomPdf
    {
        $data = $this->build($client);

        return Pdf::loadView('clients.statement', [
            ...$data,
            'logoDataUri' => $this->brand->logoDataUri(),
            'logoHeaderDataUri' => $this->brand->logoHeaderDataUri(),
        ])->setPaper('a4');
    }

    public function downloadExcel(Client $client): StreamedResponse
    {
        $data = $this->build($client);
        $slug = preg_replace('/[^a-zA-Z0-9_-]+/', '-', $client->name) ?: 'client';
        $filename = 'etat-client-'.$slug.'-'.now()->format('Y-m-d').'.xls';

        $xml = $this->toSpreadsheetXml($data);

        return response()->streamDownload(function () use ($xml) {
            echo $xml;
        }, $filename, [
            'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
        ]);
    }

    private function paymentDescription(Payment $payment): string
    {
        $parts = ['Paiement — '.$this->methodLabel($payment->method)];

        if ($payment->invoice) {
            $parts[] = 'facture '.$payment->invoice->reference;
        } elseif ($payment->sale) {
            $label = $payment->sale->sale_type === 'legacy_credit' ? 'crédit' : 'vente';
            $parts[] = $label.' '.$payment->sale->reference;
        } else {
            $parts[] = 'imputation auto. client';
        }

        if ($payment->bank_reference) {
            $parts[] = 'réf. banque '.$payment->bank_reference;
        }

        return implode(' · ', $parts);
    }

    private function methodLabel(string $method): string
    {
        return match ($method) {
            'especes' => 'Espèces',
            'cheque' => 'Chèque',
            'virement' => 'Virement',
            'effet' => 'Effet',
            default => 'Autre',
        };
    }

    /**
     * @param  array{
     *     client: Client,
     *     company: array<string, mixed>,
     *     generated_at: string,
     *     balance: array<string, float|int>,
     *     lines: list<array{date: string, reference: string, description: string, type: string, debit: float, credit: float, balance: float}>,
     *     totals: array{debit: float, credit: float, balance: float}
     * }  $data
     */
    private function toSpreadsheetXml(array $data): string
    {
        $client = $data['client'];
        $company = $data['company'];
        $balance = $data['balance'];
        $currency = $company['currency'] ?? 'MAD';
        $companyName = (string) ($company['name'] ?? $company['app_name'] ?? 'TexFlow');

        $xml = [];
        $xml[] = '<?xml version="1.0" encoding="UTF-8"?>';
        $xml[] = '<?mso-application progid="Excel.Sheet"?>';
        $xml[] = '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"'
            .' xmlns:o="urn:schemas-microsoft-com:office:office"'
            .' xmlns:x="urn:schemas-microsoft-com:office:excel"'
            .' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"'
            .' xmlns:html="http://www.w3.org/TR/REC-html40">';
        $xml[] = '<Styles>';
        $xml[] = $this->excelStyles();
        $xml[] = '</Styles>';
        $xml[] = '<Worksheet ss:Name="Etat client">';
        $xml[] = '<Table ss:DefaultRowHeight="18">';
        $xml[] = '<Column ss:Index="1" ss:AutoFitWidth="0" ss:Width="90"/>';   // Date
        $xml[] = '<Column ss:Index="2" ss:AutoFitWidth="0" ss:Width="130"/>';  // Référence
        $xml[] = '<Column ss:Index="3" ss:AutoFitWidth="0" ss:Width="280"/>';  // Libellé
        $xml[] = '<Column ss:Index="4" ss:AutoFitWidth="0" ss:Width="100"/>';  // Débit
        $xml[] = '<Column ss:Index="5" ss:AutoFitWidth="0" ss:Width="100"/>';  // Crédit
        $xml[] = '<Column ss:Index="6" ss:AutoFitWidth="0" ss:Width="110"/>';  // Solde

        // Title
        $xml[] = '<Row ss:Height="28">'.$this->excelCell($companyName, 'Title', 6).'</Row>';
        $xml[] = '<Row ss:Height="22">'.$this->excelCell('RELEVÉ DE COMPTE CLIENT', 'Subtitle', 6).'</Row>';
        $xml[] = '<Row>'.$this->excelCell('Généré le '.$data['generated_at'].' · Devise '.$currency, 'Muted', 6).'</Row>';
        $xml[] = '<Row></Row>';

        // Client block
        $xml[] = '<Row>'.$this->excelCell('Client', 'Label').$this->excelCell($client->name, 'ValueBold', 5).'</Row>';
        if ($client->ice_number) {
            $xml[] = '<Row>'.$this->excelCell('ICE', 'Label').$this->excelCell((string) $client->ice_number, 'Value', 5).'</Row>';
        }
        if ($client->cin) {
            $xml[] = '<Row>'.$this->excelCell('CIN', 'Label').$this->excelCell((string) $client->cin, 'Value', 5).'</Row>';
        }
        if ($client->rc) {
            $xml[] = '<Row>'.$this->excelCell('RC', 'Label').$this->excelCell((string) $client->rc, 'Value', 5).'</Row>';
        }
        if ($client->phone) {
            $xml[] = '<Row>'.$this->excelCell('Téléphone', 'Label').$this->excelCell((string) $client->phone, 'Value', 5).'</Row>';
        }
        if ($client->email) {
            $xml[] = '<Row>'.$this->excelCell('Email', 'Label').$this->excelCell((string) $client->email, 'Value', 5).'</Row>';
        }
        if ($client->city) {
            $xml[] = '<Row>'.$this->excelCell('Ville', 'Label').$this->excelCell((string) $client->city, 'Value', 5).'</Row>';
        }
        if ($client->address) {
            $xml[] = '<Row>'.$this->excelCell('Adresse', 'Label').$this->excelCell((string) $client->address, 'Value', 5).'</Row>';
        }

        $xml[] = '<Row></Row>';

        // Summary box
        $xml[] = '<Row ss:Height="20">'
            .$this->excelCell('Synthèse', 'SectionHead', 6)
            .'</Row>';
        $xml[] = '<Row>'
            .$this->excelCell('Total ventes', 'SummaryLabel')
            .$this->excelNumber((float) ($balance['total_sales'] ?? 0), 'SummaryAmount')
            .$this->excelCell($currency, 'SummaryCurrency')
            .'</Row>';
        $xml[] = '<Row>'
            .$this->excelCell('Total encaissements', 'SummaryLabel')
            .$this->excelNumber((float) ($balance['total_paid'] ?? 0), 'SummaryAmount')
            .$this->excelCell($currency, 'SummaryCurrency')
            .'</Row>';
        $xml[] = '<Row>'
            .$this->excelCell('Solde dû', 'SummaryLabelBold')
            .$this->excelNumber((float) ($balance['balance_due'] ?? 0), 'SummaryBalance')
            .$this->excelCell($currency, 'SummaryCurrencyBold')
            .'</Row>';

        $xml[] = '<Row></Row>';

        // Table header
        $xml[] = '<Row ss:Height="22">'
            .$this->excelCell('Date', 'TableHead')
            .$this->excelCell('Référence', 'TableHead')
            .$this->excelCell('Libellé', 'TableHead')
            .$this->excelCell('Débit ('.$currency.')', 'TableHead')
            .$this->excelCell('Crédit ('.$currency.')', 'TableHead')
            .$this->excelCell('Solde ('.$currency.')', 'TableHead')
            .'</Row>';

        $alt = false;
        foreach ($data['lines'] as $line) {
            $style = $alt ? 'TableCellAlt' : 'TableCell';
            $numStyle = $alt ? 'TableNumAlt' : 'TableNum';
            $xml[] = '<Row>'
                .$this->excelCell($this->formatDate($line['date']), $style)
                .$this->excelCell($line['reference'], $style)
                .$this->excelCell($line['description'], $style)
                .($line['debit'] > 0
                    ? $this->excelNumber($line['debit'], $numStyle)
                    : $this->excelCell('—', $numStyle))
                .($line['credit'] > 0
                    ? $this->excelNumber($line['credit'], $numStyle)
                    : $this->excelCell('—', $numStyle))
                .$this->excelNumber($line['balance'], $numStyle)
                .'</Row>';
            $alt = ! $alt;
        }

        $xml[] = '<Row ss:Height="22">'
            .$this->excelCell('', 'TableTotal')
            .$this->excelCell('', 'TableTotal')
            .$this->excelCell('Totaux', 'TableTotal')
            .$this->excelNumber($data['totals']['debit'], 'TableTotalNum')
            .$this->excelNumber($data['totals']['credit'], 'TableTotalNum')
            .$this->excelNumber($data['totals']['balance'], 'TableTotalNum')
            .'</Row>';

        $xml[] = '<Row></Row>';
        $xml[] = '<Row>'.$this->excelCell(
            'Débits = ventes et crédits client · Crédits = paiements confirmés · Solde = cumul (débit − crédit).',
            'Footer',
            6
        ).'</Row>';

        $xml[] = '</Table>';
        $xml[] = '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">'
            .'<PageSetup><Layout x:Orientation="Landscape"/><Header x:Margin="0.3"/><Footer x:Margin="0.3"/>'
            .'<PageMargins x:Bottom="0.5" x:Left="0.4" x:Right="0.4" x:Top="0.5"/></PageSetup>'
            .'<FitToPage/><Print><ValidPrinterInfo/><FitWidth>1</FitWidth><FitHeight>0</FitHeight></Print>'
            .'<Selected/><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios>'
            .'</WorksheetOptions>';
        $xml[] = '</Worksheet>';
        $xml[] = '</Workbook>';

        return implode("\n", $xml);
    }

    private function excelStyles(): string
    {
        $border = '<Borders>'
            .'<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>'
            .'<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>'
            .'<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>'
            .'<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>'
            .'</Borders>';

        $borderStrong = '<Borders>'
            .'<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F766E"/>'
            .'<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F766E"/>'
            .'<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F766E"/>'
            .'<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F766E"/>'
            .'</Borders>';

        return implode('', [
            '<Style ss:ID="Default"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/></Style>',
            '<Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Size="18" ss:Bold="1" ss:Color="#0F766E"/><Alignment ss:Vertical="Center"/></Style>',
            '<Style ss:ID="Subtitle"><Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#0F172A"/><Alignment ss:Vertical="Center"/></Style>',
            '<Style ss:ID="Muted"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#64748B"/></Style>',
            '<Style ss:ID="Label"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#64748B"/><Alignment ss:Vertical="Center"/></Style>',
            '<Style ss:ID="Value"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/><Alignment ss:Vertical="Center"/></Style>',
            '<Style ss:ID="ValueBold"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/><Alignment ss:Vertical="Center"/></Style>',
            '<Style ss:ID="SectionHead"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0D9488" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>',
            '<Style ss:ID="SummaryLabel"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#334155"/>'.$border.'<Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style>',
            '<Style ss:ID="SummaryLabelBold"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>'.$borderStrong.'<Interior ss:Color="#CCFBF1" ss:Pattern="Solid"/></Style>',
            '<Style ss:ID="SummaryAmount"><NumberFormat ss:Format="#,##0.00"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/>'.$border.'<Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style>',
            '<Style ss:ID="SummaryBalance"><NumberFormat ss:Format="#,##0.00"/><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F766E"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/>'.$borderStrong.'<Interior ss:Color="#CCFBF1" ss:Pattern="Solid"/></Style>',
            '<Style ss:ID="SummaryCurrency"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#64748B"/><Alignment ss:Vertical="Center"/>'.$border.'<Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style>',
            '<Style ss:ID="SummaryCurrencyBold"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F766E"/><Alignment ss:Vertical="Center"/>'.$borderStrong.'<Interior ss:Color="#CCFBF1" ss:Pattern="Solid"/></Style>',
            '<Style ss:ID="TableHead"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#134E4A" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/>'.$borderStrong.'</Style>',
            '<Style ss:ID="TableCell"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/><Alignment ss:Vertical="Center" ss:WrapText="1"/>'.$border.'</Style>',
            '<Style ss:ID="TableCellAlt"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/><Alignment ss:Vertical="Center" ss:WrapText="1"/>'.$border.'<Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/></Style>',
            '<Style ss:ID="TableNum"><NumberFormat ss:Format="#,##0.00"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/>'.$border.'</Style>',
            '<Style ss:ID="TableNumAlt"><NumberFormat ss:Format="#,##0.00"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/>'.$border.'<Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/></Style>',
            '<Style ss:ID="TableTotal"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/><Interior ss:Color="#99F6E4" ss:Pattern="Solid"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/>'.$borderStrong.'</Style>',
            '<Style ss:ID="TableTotalNum"><NumberFormat ss:Format="#,##0.00"/><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/><Interior ss:Color="#99F6E4" ss:Pattern="Solid"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/>'.$borderStrong.'</Style>',
            '<Style ss:ID="Footer"><Font ss:FontName="Calibri" ss:Size="9" ss:Italic="1" ss:Color="#64748B"/><Alignment ss:WrapText="1"/></Style>',
        ]);
    }

    private function excelCell(string $value, string $style, int $mergeAcross = 1): string
    {
        $attrs = ' ss:StyleID="'.$style.'"';
        if ($mergeAcross > 1) {
            $attrs .= ' ss:MergeAcross="'.($mergeAcross - 1).'"';
        }

        return '<Cell'.$attrs.'><Data ss:Type="String">'
            .htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8')
            .'</Data></Cell>';
    }

    private function excelNumber(float $value, string $style): string
    {
        // Dot decimal for Excel Number type; NumberFormat handles display.
        $raw = number_format(round($value, 2), 2, '.', '');

        return '<Cell ss:StyleID="'.$style.'"><Data ss:Type="Number">'.$raw.'</Data></Cell>';
    }

    private function formatDate(string $date): string
    {
        try {
            return \Carbon\Carbon::parse($date)->format('d/m/Y');
        } catch (\Throwable) {
            return $date;
        }
    }
}
