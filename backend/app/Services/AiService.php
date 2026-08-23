<?php

namespace App\Services;

use App\Models\Client;
use Illuminate\Support\Facades\Cache;

class AiService
{
    public function __construct(
        private OpenRouterService $openRouter,
        private PricingContextService $pricingContext,
        private CompanySettingsService $companySettings,
    ) {}

    private function companyLabel(): string
    {
        $config = $this->companySettings->config();

        return (string) ($config['name'] ?: $config['app_name'] ?: 'TexFlow');
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     */
    public function assistantChat(string $message, string $locale, array $history = []): string
    {
        $language = $locale === 'ar' ? 'Arabic' : 'French';
        $company = $this->companyLabel();
        $system = <<<PROMPT
You are the assistant for {$company}, a textile import and wholesale management app.
Answer in {$language} only.
Help users with: clients, sales (ventes), legacy credits (crédits), payments, invoices, stock, containers, fabric types.
Be concise and practical. Never invent data — if you lack information, say so.
Do not execute actions; only explain how to use the app.
PROMPT;

        $messages = [['role' => 'system', 'content' => $system]];

        foreach (array_slice($history, -8) as $entry) {
            if (in_array($entry['role'] ?? '', ['user', 'assistant'], true) && ! empty($entry['content'])) {
                $messages[] = [
                    'role' => $entry['role'],
                    'content' => (string) $entry['content'],
                ];
            }
        }

        $messages[] = ['role' => 'user', 'content' => $message];

        return $this->openRouter->chat($messages, 0.4);
    }

    public function clientSummary(Client $client, string $locale): array
    {
        $cacheKey = "ai_client_summary_{$client->id}_{$locale}_{$client->updated_at?->timestamp}";

        return Cache::remember($cacheKey, now()->addMinutes(30), function () use ($client, $locale) {
            $language = $locale === 'ar' ? 'Arabic' : 'French';
            $data = $this->pricingContext->buildClientSummaryData($client);
            $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

            $company = $this->companyLabel();
            $system = <<<PROMPT
You summarize client accounts for {$company} textile wholesaler.
Respond ONLY with valid JSON (no markdown):
{"summary":"2-4 sentences in {$language}","highlights":["bullet 1","bullet 2","bullet 3"]}
Cover: balance (ventes vs crédits), payment behavior, risks, and recent activity.
Use MAD for amounts. Be factual based on the data only.
PROMPT;

            $raw = $this->openRouter->chat([
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => "Client data:\n{$json}"],
            ], 0.2);

            $parsed = $this->parseJsonResponse($raw);

            return [
                'summary' => (string) ($parsed['summary'] ?? $raw),
                'highlights' => array_values(array_filter(
                    (array) ($parsed['highlights'] ?? []),
                    fn ($h) => is_string($h) && trim($h) !== '',
                )),
            ];
        });
    }

    public function pricingHint(
        int $fabricTypeId,
        string $locale,
        ?int $clientId = null,
        ?float $quantityM2 = null,
        ?string $marketNote = null,
    ): array {
        $language = $locale === 'ar' ? 'Arabic' : 'French';
        $context = $this->pricingContext->buildForFabric($fabricTypeId, $clientId);
        $context['requested_quantity_m2'] = $quantityM2;
        $context['user_market_note'] = $marketNote;

        $json = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        $company = $this->companyLabel();
        $system = <<<PROMPT
You are a pricing advisor for {$company} textile wholesaler.
PRIMARY RULE: sell price = landed cost per m² × (1 + target margin %). Landed cost = purchase + shipping + customs + other fees allocated per m² from containers.
Do NOT follow market price as the main rule — market is only a soft reference. Protect margin first so the company makes a profit.
Respond ONLY with valid JSON (no markdown):
{
  "suggested_price_m2_mad": number,
  "min_price_m2_mad": number,
  "max_price_m2_mad": number,
  "landed_cost_m2_mad": number|null,
  "target_margin_pct": number,
  "summary": "short explanation in {$language} focusing on cost + margin",
  "factors": ["factor 1", "factor 2"]
}
If landed cost is unknown, say so clearly and refuse to invent a below-cost price.
PROMPT;

        $raw = $this->openRouter->chat([
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => "Pricing context:\n{$json}"],
        ], 0.25);

        $parsed = $this->parseJsonResponse($raw);

        return [
            'suggested_price_m2_mad' => isset($parsed['suggested_price_m2_mad'])
                ? round((float) $parsed['suggested_price_m2_mad'], 2)
                : null,
            'min_price_m2_mad' => isset($parsed['min_price_m2_mad'])
                ? round((float) $parsed['min_price_m2_mad'], 2)
                : null,
            'max_price_m2_mad' => isset($parsed['max_price_m2_mad'])
                ? round((float) $parsed['max_price_m2_mad'], 2)
                : null,
            'landed_cost_m2_mad' => isset($parsed['landed_cost_m2_mad'])
                ? round((float) $parsed['landed_cost_m2_mad'], 2)
                : $context['avg_landed_cost_m2_mad'],
            'target_margin_pct' => isset($parsed['target_margin_pct'])
                ? round((float) $parsed['target_margin_pct'], 2)
                : $context['fabric']['target_margin_pct'],
            'summary' => (string) ($parsed['summary'] ?? $raw),
            'factors' => array_values(array_filter(
                (array) ($parsed['factors'] ?? []),
                fn ($f) => is_string($f) && trim($f) !== '',
            )),
            'context' => $context,
        ];
    }

    /** @return array<string, mixed> */
    private function parseJsonResponse(string $raw): array
    {
        $raw = trim($raw);

        if (preg_match('/```(?:json)?\s*([\s\S]*?)```/', $raw, $matches)) {
            $raw = trim($matches[1]);
        }

        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : [];
    }
}
