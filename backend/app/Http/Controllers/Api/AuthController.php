<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private ActivityLogger $logger) {}

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Identifiants incorrects.'],
            ]);
        }

        $token = $user->createToken('texflow')->plainTextToken;

        $this->logger->log(
            $user,
            $request,
            'login',
            "Connexion — {$user->name} ({$user->role})",
            'auth',
            $user->id,
        );

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        $this->logger->log(
            $user,
            $request,
            'logout',
            "Déconnexion — {$user->name}",
            'auth',
            $user->id,
        );

        $user->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnexion réussie']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'current_password' => ['required_with:password', 'string'],
            'password' => ['sometimes', 'nullable', 'string', 'confirmed', Password::min(8)],
        ]);

        if (! empty($data['password'])) {
            if (! Hash::check($data['current_password'], $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['Mot de passe actuel incorrect.'],
                ]);
            }
        }

        $updates = [];

        if (array_key_exists('name', $data)) {
            $updates['name'] = $data['name'];
        }

        if (array_key_exists('email', $data)) {
            $updates['email'] = $data['email'];
        }

        if (! empty($data['password'])) {
            $updates['password'] = $data['password'];
        }

        if ($updates !== []) {
            $user->update($updates);
        }

        $this->logger->log(
            $user,
            $request,
            'updated',
            "Profil mis à jour — {$user->name}",
            'user',
            $user->id,
        );

        return response()->json($user->fresh());
    }
}
