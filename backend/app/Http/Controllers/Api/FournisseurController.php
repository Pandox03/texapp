<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Fournisseur;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FournisseurController extends Controller
{
    public function __construct(private ActivityLogger $logger) {}

    public function index(Request $request): JsonResponse
    {
        $query = Fournisseur::query();

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('contact_person', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('ice_number', 'like', "%{$search}%")
                    ->orWhere('cin', 'like', "%{$search}%")
                    ->orWhere('rc', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $fournisseur = Fournisseur::create($data);

        $this->logger->log(
            $request->user(),
            $request,
            'created',
            "Fournisseur créé — {$fournisseur->name}",
            'fournisseur',
            $fournisseur->id,
        );

        return response()->json($fournisseur, 201);
    }

    public function update(Request $request, Fournisseur $fournisseur): JsonResponse
    {
        $data = $this->validated($request, false);
        $fournisseur->update($data);

        $this->logger->log(
            $request->user(),
            $request,
            'updated',
            "Fournisseur modifié — {$fournisseur->name}",
            'fournisseur',
            $fournisseur->id,
        );

        return response()->json($fournisseur->fresh());
    }

    public function destroy(Request $request, Fournisseur $fournisseur): JsonResponse
    {
        $name = $fournisseur->name;
        $id = $fournisseur->id;
        $fournisseur->delete();

        $this->logger->log(
            $request->user(),
            $request,
            'deleted',
            "Fournisseur supprimé — {$name}",
            'fournisseur',
            $id,
        );

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, bool $creating = true): array
    {
        return $request->validate([
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:150'],
            'contact_person' => ['nullable', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'ice_number' => ['nullable', 'string', 'max:50'],
            'cin' => ['nullable', 'string', 'max:50', 'required_without:rc'],
            'rc' => ['nullable', 'string', 'max:50', 'required_without:cin'],
            'notes' => ['nullable', 'string'],
        ]);
    }
}
