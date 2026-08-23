@extends('emails.layout')

@section('title', 'Nouveau paiement — '.$payment->reference)

@section('content')
@php
    $methodColors = match($payment->method) {
        'especes' => ['bg' => '#d1fae5', 'text' => '#065f46'],
        'virement' => ['bg' => '#dbeafe', 'text' => '#1e40af'],
        'cheque' => ['bg' => '#ede9fe', 'text' => '#5b21b6'],
        default => ['bg' => '#f1f5f9', 'text' => '#475569'],
    };
@endphp

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
        <td>
            <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#0d9488;text-transform:uppercase;letter-spacing:0.6px;">
                Nouveau paiement
            </p>
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#0f172a;line-height:1.2;">
                {{ $payment->reference }}
            </h1>
            <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
                Un encaissement vient d'être enregistré pour le client {{ $payment->client?->name ?? '' }}.
                @if($payment->invoice)
                    Il est lié à la facture {{ $payment->invoice->reference }}.
                @else
                    Le montant sera réparti automatiquement sur les factures les plus anciennes.
                @endif
            </p>
        </td>
    </tr>
</table>

{{-- Highlight amount --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr>
        <td style="background:linear-gradient(135deg,#ecfdf5 0%,#f0fdf4 100%);border:1px solid #86efac;border-radius:12px;padding:24px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.5px;">Montant encaissé</p>
            <p style="margin:0 0 12px;font-size:36px;font-weight:700;color:#0f172a;letter-spacing:-1px;">
                {{ number_format((float) $payment->amount, 2, ',', ' ') }} <span style="font-size:18px;font-weight:600;color:#64748b;">MAD</span>
            </p>
            <span style="display:inline-block;background:{{ $methodColors['bg'] }};color:{{ $methodColors['text'] }};font-size:12px;font-weight:600;padding:5px 14px;border-radius:20px;">
                {{ $methodLabel }}
            </span>
        </td>
    </tr>
</table>

{{-- Details --}}
@php
    $rows = array_values(array_filter([
        ['Client', $payment->client?->name ?? '—'],
        ['Facture', $payment->invoice?->reference ?? 'Répartition automatique (FIFO)'],
        ['Date paiement', $payment->payment_date?->format('d/m/Y') ?? '—'],
        ['Statut', $payment->status === 'confirmed' ? 'Confirmé' : ucfirst($payment->status ?? '—')],
        $payment->bank_reference ? ['Réf. banque', $payment->bank_reference] : null,
        $payment->invoice ? ['Reste sur facture', number_format($payment->invoice->remainingToPay(), 2, ',', ' ').' MAD'] : null,
    ]));
@endphp
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    @foreach($rows as $index => $row)
        <tr style="background-color:{{ $index % 2 === 0 ? '#ffffff' : '#f8fafc' }};">
            <td style="padding:12px 16px;font-size:13px;color:#64748b;width:40%;border-bottom:1px solid #f1f5f9;">{{ $row[0] }}</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">{{ $row[1] }}</td>
        </tr>
    @endforeach
</table>

@if($payment->proof_document)
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr>
        <td style="background-color:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;padding:14px 16px;">
            <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.5;">
                <strong>📎 Pièce jointe</strong> — Justificatif de paiement ({{ $methodLabel }})
            </p>
        </td>
    </tr>
</table>
@endif

<table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
        <td style="border-radius:10px;background-color:#0d9488;">
            <a href="{{ $appUrl }}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                Ouvrir {{ config('company.app_name', config('company.name')) }} →
            </a>
        </td>
    </tr>
</table>
@endsection
