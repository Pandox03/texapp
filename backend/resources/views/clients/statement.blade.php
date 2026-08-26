<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>État de compte — {{ $client->name }}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 10px;
            color: #111;
            line-height: 1.35;
        }
        .page { padding: 18px 22px 40px; }
        .brand-block { margin-bottom: 12px; }
        .brand-block img { max-height: 52px; max-width: 240px; display: block; }
        .brand-name {
            margin-top: 4px;
            font-size: 14px;
            font-weight: bold;
            color: #0d9488;
        }
        .title {
            margin: 10px 0 14px;
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }
        .meta {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
        }
        .meta td {
            vertical-align: top;
            padding: 8px 10px;
            border: 1px solid #222;
            width: 50%;
        }
        .meta .lbl { color: #555; font-size: 9px; text-transform: uppercase; }
        .meta .val { font-size: 12px; font-weight: bold; margin-top: 2px; }
        .summary {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
        }
        .summary th, .summary td {
            border: 1px solid #222;
            padding: 7px 8px;
            text-align: center;
        }
        .summary th {
            background: #f3f4f6;
            font-size: 9px;
            text-transform: uppercase;
        }
        .summary .strong { font-weight: bold; color: #0f766e; }
        table.lines {
            width: 100%;
            border-collapse: collapse;
        }
        table.lines th, table.lines td {
            border: 1px solid #333;
            padding: 5px 6px;
        }
        table.lines th {
            background: #111;
            color: #fff;
            font-size: 9px;
            text-transform: uppercase;
        }
        table.lines td.num { text-align: right; white-space: nowrap; }
        table.lines td.center { text-align: center; white-space: nowrap; }
        table.lines tr.totals td {
            font-weight: bold;
            background: #f3f4f6;
        }
        .footer-note {
            margin-top: 12px;
            font-size: 9px;
            color: #555;
        }
        .empty {
            padding: 16px;
            text-align: center;
            border: 1px dashed #999;
            color: #666;
        }
    </style>
</head>
<body>
@php
    $fmt = fn ($n) => number_format((float) $n, 2, ',', ' ');
    $fmtDate = function ($d) {
        try { return \Carbon\Carbon::parse($d)->format('d/m/Y'); } catch (\Throwable) { return $d; }
    };
    $currency = $company['currency'] ?? 'MAD';
@endphp
<div class="page">
    <div class="brand-block">
        @if(!empty($logoHeaderDataUri))
            <img src="{{ $logoHeaderDataUri }}" alt="Logo">
        @elseif(!empty($logoDataUri))
            <img src="{{ $logoDataUri }}" alt="Logo">
        @endif
        <div class="brand-name">{{ $company['name'] ?? $company['app_name'] ?? 'TexFlow' }}</div>
    </div>

    <div class="title">État de compte client</div>

    <table class="meta">
        <tr>
            <td>
                <div class="lbl">Client</div>
                <div class="val">{{ $client->name }}</div>
                @if($client->ice_number)<div>ICE : {{ $client->ice_number }}</div>@endif
                @if($client->cin)<div>CIN : {{ $client->cin }}</div>@endif
                @if($client->rc)<div>RC : {{ $client->rc }}</div>@endif
                @if($client->phone)<div>Tél : {{ $client->phone }}</div>@endif
                @if($client->city)<div>Ville : {{ $client->city }}</div>@endif
                @if($client->address)<div>{{ $client->address }}</div>@endif
            </td>
            <td>
                <div class="lbl">Document</div>
                <div class="val">Relevé de situation</div>
                <div>Généré le : {{ $generated_at }}</div>
                <div>Devise : {{ $currency }}</div>
            </td>
        </tr>
    </table>

    <table class="summary">
        <thead>
            <tr>
                <th>Total ventes</th>
                <th>Total encaissements</th>
                <th>Solde ventes</th>
                <th>Solde crédits</th>
                <th>Solde dû</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{{ $fmt($balance['total_sales'] ?? 0) }}</td>
                <td>{{ $fmt($balance['total_paid'] ?? 0) }}</td>
                <td>{{ $fmt($balance['sales_balance_due'] ?? 0) }}</td>
                <td>{{ $fmt($balance['credits_balance_due'] ?? 0) }}</td>
                <td class="strong">{{ $fmt($balance['balance_due'] ?? 0) }} {{ $currency }}</td>
            </tr>
        </tbody>
    </table>

    @if(count($lines) === 0)
        <div class="empty">Aucun mouvement pour ce client.</div>
    @else
        <table class="lines">
            <thead>
                <tr>
                    <th style="width:12%">Date</th>
                    <th style="width:16%">Référence</th>
                    <th>Libellé</th>
                    <th style="width:12%">Débit</th>
                    <th style="width:12%">Crédit</th>
                    <th style="width:12%">Solde</th>
                </tr>
            </thead>
            <tbody>
                @foreach($lines as $line)
                    <tr>
                        <td class="center">{{ $fmtDate($line['date']) }}</td>
                        <td>{{ $line['reference'] }}</td>
                        <td>{{ $line['description'] }}</td>
                        <td class="num">{{ $line['debit'] > 0 ? $fmt($line['debit']) : '—' }}</td>
                        <td class="num">{{ $line['credit'] > 0 ? $fmt($line['credit']) : '—' }}</td>
                        <td class="num">{{ $fmt($line['balance']) }}</td>
                    </tr>
                @endforeach
                <tr class="totals">
                    <td colspan="3">Totaux</td>
                    <td class="num">{{ $fmt($totals['debit']) }}</td>
                    <td class="num">{{ $fmt($totals['credit']) }}</td>
                    <td class="num">{{ $fmt($totals['balance']) }}</td>
                </tr>
            </tbody>
        </table>
    @endif

    <p class="footer-note">
        Débits = ventes et crédits client · Crédits = paiements confirmés · Solde = cumul (débit − crédit).
        Montants en {{ $currency }}.
    </p>
</div>
</body>
</html>
