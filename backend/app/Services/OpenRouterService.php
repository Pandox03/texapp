<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OpenRouterService
{
    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    public function chat(array $messages, float $temperature = 0.3): string
    {
        $apiKey = config('openrouter.api_key');

        if (! $apiKey) {
            throw new RuntimeException('OPENROUTER_API_KEY is not configured.');
        }

        $timeout = max(30, (int) config('openrouter.timeout', 90));
        $connectTimeout = max(10, (int) config('openrouter.connect_timeout', 30));

        try {
            $response = Http::timeout($timeout)
                ->connectTimeout($connectTimeout)
                ->retry(3, 2000, fn ($exception) => $exception instanceof ConnectionException)
                ->withHeaders([
                    'Authorization' => 'Bearer '.$apiKey,
                    'HTTP-Referer' => (string) config('openrouter.site_url'),
                    'X-Title' => (string) config('openrouter.site_name'),
                    'Accept' => 'application/json',
                ])
                ->post(rtrim((string) config('openrouter.base_url'), '/').'/chat/completions', [
                    'model' => config('openrouter.model'),
                    'messages' => $messages,
                    'temperature' => $temperature,
                    // Cap output so free/low-credit accounts are not billed for the model default (~65k).
                    'max_tokens' => max(256, min((int) config('openrouter.max_tokens', 2048), 8000)),
                ]);
        } catch (ConnectionException $e) {
            throw new RuntimeException(
                'Impossible de joindre OpenRouter (délai SSL/réseau). Réessayez, vérifiez VPN/pare-feu, ou augmentez OPENROUTER_CONNECT_TIMEOUT dans .env.',
                0,
                $e,
            );
        }

        if (! $response->successful()) {
            $message = $response->json('error.message') ?? $response->body();
            throw new RuntimeException('OpenRouter error: '.$message);
        }

        $content = $response->json('choices.0.message.content');

        if (! is_string($content) || trim($content) === '') {
            throw new RuntimeException('OpenRouter returned an empty response.');
        }

        return trim($content);
    }
}
