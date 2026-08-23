<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Payment;
use App\Models\Sale;
use App\Services\ActivityLogger;
use App\Services\AdminNotificationService;
use App\Services\BillingService;
use App\Services\ReferenceGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Response;

class PaymentController extends Controller
{
    public function __construct(
        private BillingService $billing,
        private ActivityLogger $logger,
        private AdminNotificationService $adminNotifications,
        private ReferenceGenerator $references,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Payment::query()->with(['client', 'invoice.sale', 'sale']);

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('reference', 'like', "%{$search}%")
                    ->orWhere('bank_reference', 'like', "%{$search}%")
                    ->orWhereHas('client', fn ($c) => $c->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('invoice', fn ($i) => $i->where('reference', 'like', "%{$search}%"));
            });
        }

        if ($clientId = $request->integer('client_id')) {
            $query->where('client_id', $clientId);
        }

        if ($method = $request->string('method')->toString()) {
            $query->where('method', $method);
        }

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($from = $request->string('date_from')->toString()) {
            $query->whereDate('payment_date', '>=', $from);
        }

        if ($to = $request->string('date_to')->toString()) {
            $query->whereDate('payment_date', '<=', $to);
        }

        $paginator = $query->latest('payment_date')->paginate(20);
        $paginator->setCollection(
            $paginator->getCollection()->map(fn (Payment $payment) => $this->formatPayment($payment))
        );

        return response()->json($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $requiresProof = in_array($request->input('method'), ['virement', 'cheque'], true);

        $data = $request->validate([
            'client_id' => ['required', 'exists:clients,id'],
            'sale_id' => ['nullable', 'exists:sales,id'],
            'reference' => ['nullable', 'string', 'max:100', 'unique:payments,reference'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_date' => ['required', 'date'],
            'method' => ['required', 'in:especes,cheque,virement,effet,autre'],
            'status' => ['nullable', 'in:pending,confirmed,cancelled'],
            'bank_reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
            'proof_document' => [
                Rule::requiredIf($requiresProof),
                'nullable',
                'file',
                'mimes:jpg,jpeg,png,pdf',
                'max:5120',
            ],
        ]);

        $data['reference'] = $data['reference'] ?? $this->references->nextPaymentReference();

        $client = Client::findOrFail($data['client_id']);
        $sale = null;

        if (! empty($data['sale_id'])) {
            $sale = Sale::findOrFail($data['sale_id']);
        }

        try {
            $this->billing->validateClientPaymentAmount($client, (float) $data['amount'], $sale);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $proofPath = null;
        if ($request->hasFile('proof_document')) {
            $proofPath = $request->file('proof_document')->store('payment-proofs', 'public');
        }

        $payment = DB::transaction(function () use ($data, $request, $client, $proofPath, $sale) {
            $payment = Payment::create([
                'client_id' => $client->id,
                'invoice_id' => null,
                'sale_id' => $sale?->id,
                'reference' => $data['reference'],
                'amount' => $data['amount'],
                'payment_date' => $data['payment_date'],
                'method' => $data['method'],
                'status' => $data['status'] ?? 'confirmed',
                'bank_reference' => $data['bank_reference'] ?? null,
                'proof_document' => $proofPath,
                'notes' => $data['notes'] ?? null,
                'user_id' => $request->user()->id,
            ]);

            $this->billing->applyPayment($payment);

            return $payment;
        });

        $payment->load(['client', 'sale']);

        $this->logger->log(
            $request->user(),
            $request,
            'created',
            $sale
                ? "Paiement crédit enregistré — {$payment->reference} ({$payment->amount} MAD) · {$client->name} · {$sale->reference}"
                : "Paiement enregistré — {$payment->reference} ({$payment->amount} MAD) · {$client->name}",
            'payment',
            $payment->id,
            ['client' => $client->name, 'amount' => $payment->amount, 'sale_id' => $sale?->id],
        );

        $this->adminNotifications->notifyPaymentRegistered($payment);

        return response()->json($this->formatPayment($payment), 201);
    }

    public function proof(Payment $payment): Response
    {
        if (! $payment->proof_document || ! Storage::disk('public')->exists($payment->proof_document)) {
            abort(404);
        }

        return Storage::disk('public')->response($payment->proof_document);
    }

    /** @return array<string, mixed> */
    private function formatPayment(Payment $payment): array
    {
        $data = $payment->toArray();
        $data['proof_document_url'] = $payment->proof_document
            ? url("/api/payments/{$payment->id}/proof")
            : null;
        $data['auto_allocated'] = $payment->invoice_id === null && $payment->sale_id === null;

        return $data;
    }
}
