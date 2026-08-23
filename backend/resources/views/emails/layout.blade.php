<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>@yield('title', config('company.name'))</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f6;padding:32px 16px;">
    <tr>
        <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
                {{-- Header --}}
                <tr>
                    <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:28px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="vertical-align:middle;">
                                    @if($logoDataUri ?? null)
                                        <img src="{{ $logoDataUri }}" alt="{{ config('company.name') }}" height="52" style="display:block;height:52px;width:auto;max-width:220px;">
                                    @else
                                        <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                                            {{ config('company.app_name', config('company.name')) }}
                                        </span>
                                    @endif
                                </td>
                                <td align="right" style="vertical-align:middle;">
                                    <span style="display:inline-block;background:rgba(255,255,255,0.12);color:#cbd5e1;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;padding:6px 12px;border-radius:20px;">
                                        Notification admin
                                    </span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                {{-- Accent bar --}}
                <tr>
                    <td style="height:4px;background:linear-gradient(90deg,#0d9488,#5eead4,#d4a853);font-size:0;line-height:0;">&nbsp;</td>
                </tr>

                {{-- Body --}}
                <tr>
                    <td style="padding:32px;">
                        @yield('content')
                    </td>
                </tr>

                {{-- Footer --}}
                <tr>
                    <td style="background-color:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;">
                        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#334155;">
                            {{ config('company.name') }} {{ config('company.legal_form') }}
                        </p>
                        <p style="margin:0 0 4px;font-size:11px;color:#64748b;line-height:1.5;">
                            {{ config('company.address') }}, {{ config('company.city') }}
                        </p>
                        <p style="margin:0;font-size:11px;color:#94a3b8;">
                            ICE {{ config('company.ice') }} · RC {{ config('company.rc') }} {{ config('company.rc_city') }}
                        </p>
                    </td>
                </tr>
            </table>

            <p style="margin:20px 0 0;font-size:11px;color:#94a3b8;text-align:center;">
                E-mail automatique — {{ config('company.app_name', config('company.name')) }} · {{ config('company.tagline', 'Import textile & gestion de stock') }}
            </p>
        </td>
    </tr>
</table>
</body>
</html>
