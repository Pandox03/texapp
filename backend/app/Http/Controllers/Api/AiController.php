<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Services\AiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

class AiController extends Controller
{
    public function __construct(private AiService $ai) {}

    public function chat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'locale' => ['nullable', 'in:fr,ar'],
            'history' => ['nullable', 'array', 'max:12'],
            'history.*.role' => ['required_with:history', 'in:user,assistant'],
            'history.*.content' => ['required_with:history', 'string', 'max:4000'],
        ]);

        try {
            $reply = $this->ai->assistantChat(
                $data['message'],
                $data['locale'] ?? 'fr',
                $data['history'] ?? [],
            );

            return response()->json(['reply' => $reply]);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    public function clientSummary(Request $request, Client $client): JsonResponse
    {
        $locale = $request->string('locale')->toString() ?: 'fr';

        if (! in_array($locale, ['fr', 'ar'], true)) {
            $locale = 'fr';
        }

        try {
            if ($request->boolean('refresh')) {
                Cache::forget("ai_client_summary_{$client->id}_{$locale}_{$client->updated_at?->timestamp}");
            }

            return response()->json(
                $this->ai->clientSummary($client, $locale),
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    public function pricingHint(Request $request): JsonResponse
    {
        $data = $request->validate([
            'fabric_type_id' => ['required', 'exists:fabric_types,id'],
            'client_id' => ['nullable', 'exists:clients,id'],
            'quantity_m2' => ['nullable', 'numeric', 'min:0.01'],
            'market_note' => ['nullable', 'string', 'max:500'],
            'locale' => ['nullable', 'in:fr,ar'],
        ]);

        try {
            return response()->json(
                $this->ai->pricingHint(
                    (int) $data['fabric_type_id'],
                    $data['locale'] ?? 'fr',
                    isset($data['client_id']) ? (int) $data['client_id'] : null,
                    isset($data['quantity_m2']) ? (float) $data['quantity_m2'] : null,
                    $data['market_note'] ?? null,
                ),
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }
}
