<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>{{ $invoice->reference }}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 11px;
            color: #000;
            line-height: 1.35;
        }
        .page {
            position: relative;
            padding: 18px 22px 56px;
        }
        .watermark {
            position: fixed;
            top: 28%;
            left: 50%;
            width: 680px;
            margin-left: -340px;
            z-index: -1;
            text-align: center;
            opacity: 0.16;
        }
        .watermark img {
            width: 100%;
            height: auto;
            display: block;
            margin: 0 auto;
        }
        .brand-block {
            margin-bottom: 14px;
        }
        .brand-block img {
            max-height: 62px;
            max-width: 260px;
            display: block;
        }
        .brand-name {
            margin-top: 4px;
            font-size: 15px;
            font-weight: bold;
            color: #0d9488;
            letter-spacing: 0.3px;
        }
        table.info-boxes {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
        }
        table.info-boxes > tbody > tr > td {
            border: 1px solid #000;
            vertical-align: middle;
            padding: 8px 10px;
        }
        table.info-boxes .info-left {
            width: 42%;
        }
        table.info-boxes .info-right {
            width: 58%;
            text-align: center;
        }
        table.info-inner {
            width: 100%;
            border-collapse: collapse;
        }
        table.info-inner td {
            padding: 2px 0;
            font-size: 11px;
        }
        table.info-inner td.lbl {
            font-weight: bold;
            width: 95px;
            white-space: nowrap;
        }
        .client-name {
            font-size: 13px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 4px;
        }
        table.invoice-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #000;
        }
        table.invoice-table th {
            border-top: none;
            border-bottom: none;
            border-left: 1px solid #000;
            border-right: none;
            padding: 6px 5px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            text-align: center;
        }
        table.invoice-table th:first-child {
            border-left: none;
        }
        table.invoice-table th.col-designation {
            text-align: left;
            padding-left: 8px;
        }
        table.invoice-table td {
            border-top: none;
            border-bottom: none;
            border-left: 1px solid #000;
            border-right: none;
            padding: 5px 6px;
            font-size: 11px;
            vertical-align: top;
        }
        table.invoice-table td:first-child {
            border-left: none;
        }
        table.invoice-table td.center { text-align: center; }
        table.invoice-table td.right { text-align: right; white-space: nowrap; }
        table.invoice-table tr.line-row td {
            height: 22px;
        }
        table.invoice-table tr.empty-row td {
            height: 22px;
        }
        table.invoice-table tfoot td {
            font-size: 11px;
            vertical-align: middle;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
        }
        table.invoice-table tbody td {
            border-top: none;
            border-bottom: none;
        }
        .amount-words-cell {
            padding: 10px 8px !important;
            font-size: 11px;
            line-height: 1.5;
        }
        .amount-words-cell strong {
            font-size: 12px;
            text-transform: capitalize;
        }
        .summary-label {
            font-weight: bold;
            text-align: left;
            padding-left: 8px !important;
            width: 18%;
        }
        .summary-value {
            font-weight: bold;
            text-align: right;
            padding-right: 8px !important;
            width: 14%;
        }
        .doc-footer {
            position: fixed;
            left: 22px;
            right: 22px;
            bottom: 14px;
            text-align: center;
            background: #ecfdf5;
            border: 1px solid #6ee7b7;
            padding: 10px 14px;
        }
        .doc-footer p {
            font-size: 9px;
            font-weight: bold;
            color: #000;
            line-height: 1.45;
            margin: 0;
        }
        .invoice-note {
            margin-top: 10px;
            font-size: 10px;
            font-weight: bold;
        }
    </style>
</head>
<body>
@php
    $lineCount = count($saleLines);
    $emptyRows = max(0, 8 - $lineCount);
    $headerLogo = $logoHeaderDataUri ?? $logoDataUri;
    $footerParts = array_filter([
        trim(($company['address'] ?? '').(! empty($company['city']) ? ' - '.strtoupper((string) $company['city']) : '')),
        ! empty($company['phone']) ? 'Tél: '.$company['phone'] : null,
        ! empty($company['email']) ? 'Email: '.$company['email'] : null,
        ! empty($company['ice']) ? 'ICE: '.$company['ice'] : null,
        ! empty($company['rc']) ? 'RC: '.$company['rc'].(! empty($company['rc_city']) ? ' ('.$company['rc_city'].')' : '') : null,
        ! empty($company['capital']) ? 'Capital: '.$company['capital'] : null,
        ! empty($company['if']) ? 'IF: '.$company['if'] : null,
        ! empty($company['tp']) ? 'T.P: '.$company['tp'] : null,
        ! empty($company['cnss']) ? 'CNSS: '.$company['cnss'] : null,
    ]);
    $footerText = implode('  ·  ', $footerParts);
@endphp

@if($headerLogo ?? $logoDataUri)
    <div class="watermark">
        <img src="{{ $headerLogo ?? $logoDataUri }}" alt="">
    </div>
@endif

<div class="page">
    <div class="brand-block">
        @if($headerLogo)
            <img src="{{ $headerLogo }}" alt="{{ $company['name'] ?? 'Logo' }}">
        @endif
        <div class="brand-name">{{ $company['name'] ?? 'Entreprise' }} {{ $company['legal_form'] ?? '' }}</div>
        @if(! empty($company['email']))
            <div style="margin-top: 2px; font-size: 10px;">{{ $company['email'] }}</div>
        @endif
    </div>

    <table class="info-boxes">
        <tr>
            <td class="info-left">
                <table class="info-inner">
                    <tr>
                        <td class="lbl">Date :</td>
                        <td>{{ $invoice->invoice_date->format('d-M-Y') }}</td>
                    </tr>
                    <tr>
                        <td class="lbl">Facture N° :</td>
                        <td>{{ $invoice->reference }}</td>
                    </tr>
                    <tr>
                        <td class="lbl">Vente N° :</td>
                        <td>{{ $saleSummary['reference'] }}</td>
                    </tr>
                </table>
            </td>
            <td class="info-right">
                <div class="client-name">{{ $invoice->client->name }}</div>
                @if($invoice->client->ice_number)
                    <div>N° ICE: {{ $invoice->client->ice_number }}</div>
                @endif
                @if($invoice->client->address || $invoice->client->city)
                    <div style="margin-top: 3px;">{{ trim(($invoice->client->address ?? '').' '.($invoice->client->city ?? '')) }}</div>
                @endif
            </td>
        </tr>
    </table>

    <table class="invoice-table">
        <thead>
            <tr>
                <th class="col-designation" style="width: 52%;">DESIGNATION</th>
                <th style="width: 8%;">U.</th>
                <th style="width: 12%;">Qté.</th>
                <th style="width: 14%;">PRIX U.</th>
                <th style="width: 14%;">TOTAL</th>
            </tr>
        </thead>
        <tbody>
            @foreach($saleLines as $line)
                <tr class="line-row">
                    <td>
                        {{ $line['fabric'] }}
                        @if($line['roll_count'] > 0)
                            ({{ $line['roll_count'] }} rouleau{{ $line['roll_count'] > 1 ? 'x' : '' }})
                        @endif
                    </td>
                    <td class="center">m²</td>
                    <td class="center">{{ number_format($line['quantity_m2'], 2, ',', ' ') }}</td>
                    <td class="right">{{ number_format($line['unit_price'], 2, ',', ' ') }}</td>
                    <td class="right">{{ number_format($line['line_total'], 2, ',', ' ') }}</td>
                </tr>
            @endforeach
            @for($i = 0; $i < $emptyRows; $i++)
                <tr class="empty-row">
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                </tr>
            @endfor
        </tbody>
        <tfoot>
            <tr>
                <td colspan="3" rowspan="4" class="amount-words-cell">
                    Arrêtée la présente facture à la somme de :<br>
                    <strong>{{ $amountInWords }}</strong>
                </td>
                <td class="summary-label">Total HT</td>
                <td class="summary-value">{{ number_format((float) $invoice->subtotal, 2, ',', ' ') }}</td>
            </tr>
            <tr>
                <td class="summary-label">T.V.A {{ number_format((float) $invoice->tax_rate, 0) }}%</td>
                <td class="summary-value">{{ number_format((float) $invoice->tax_amount, 2, ',', ' ') }}</td>
            </tr>
            <tr>
                <td class="summary-label">Total TTC</td>
                <td class="summary-value">{{ number_format((float) $invoice->total, 2, ',', ' ') }}</td>
            </tr>
            <tr>
                <td class="summary-label">CHEQUE N°</td>
                <td class="summary-value">&nbsp;</td>
            </tr>
        </tfoot>
    </table>

    @if($invoice->notes)
        <div class="invoice-note">
            <strong>Notes :</strong> {{ $invoice->notes }}
        </div>
    @endif
</div>

<div class="doc-footer">
    <p>{{ $footerText }}</p>
</div>
</body>
</html>
