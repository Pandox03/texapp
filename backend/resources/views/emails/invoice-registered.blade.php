@extends('emails.layout')

@section('title', 'Nouvelle facture — '.$invoice->reference)

@section('content')
@php
    $statusColors = match($statusLabel) {
        'Payée' => ['bg' => '#d1fae5', 'text' => '#065f46'],
        'Non payée' => ['bg' => '#fef3c7', 'text' => '#92400e'],
        default => ['bg' => '#ccfbf1', 'text' => '#0f766e'],
    };
@endphp

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
        <td>
            <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#0d9488;text-transform:uppercase;letter-spacing:0.6px;">
                Nouvelle facture
            </p>
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#0f172a;line-height:1.2;">
                {{ $invoice->reference }}
            </h1>
            <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
                Une facture vient d'être enregistrée dans {{ config('company.app_name', config('company.name')) }}. Le PDF est joint à cet e-mail.
            </p>
        </td>
    </tr>
</table>

{{-- Highlight amount --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr>
        <td style="background:linear-gradient(135deg,#f0fdfa 0%,#ecfeff 100%);border:1px solid #99f6e4;border-radius:12px;padding:24px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#0f766e;text-transform:uppercase;letter-spacing:0.5px;">Total TTC</p>
            <p style="margin:0 0 12px;font-size:36px;font-weight:700;color:#0f172a;letter-spacing:-1px;">
                {{ number_format((float) $invoice->total, 2, ',', ' ') }} <span style="font-size:18px;font-weight:600;color:#64748b;">MAD</span>
            </p>
            <span style="display:inline-block;background:{{ $statusColors['bg'] }};color:{{ $statusColors['text'] }};font-size:12px;font-weight:600;padding:5px 14px;border-radius:20px;">
                {{ $statusLabel }}
            </span>
        </td>
    </tr>
</table>

{{-- Details --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    @foreach([
        ['Client', $invoice->client?->name ?? '—'],
        ['Vente liée', $invoice->sale?->reference ?? '—'],
        ['Date facture', $invoice->invoice_date?->format('d/m/Y') ?? '—'],
        ['Échéance', $invoice->due_date?->format('d/m/Y') ?? '—'],
        ['Montant HT', number_format((float) $invoice->subtotal, 2, ',', ' ').' MAD'],
        ['TVA ('.number_format((float) $invoice->tax_rate, 0).' %)', number_format((float) $invoice->tax_amount, 2, ',', ' ').' MAD'],
    ] as $index => [$label, $value])
        <tr style="background-color:{{ $index % 2 === 0 ? '#ffffff' : '#f8fafc' }};">
            <td style="padding:12px 16px;font-size:13px;color:#64748b;width:40%;border-bottom:1px solid #f1f5f9;">{{ $label }}</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">{{ $value }}</td>
        </tr>
    @endforeach
</table>

{{-- Attachment note --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr>
        <td style="background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 16px;">
            <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
                <strong>📎 Pièce jointe</strong> — Facture PDF ({{ $invoice->reference }}.pdf)
            </p>
        </td>
    </tr>
</table>

{{-- CTA --}}
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
