<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\CompanySettingsController;
use App\Http\Controllers\Api\ComptableController;
use App\Http\Controllers\Api\ContainerController;
use App\Http\Controllers\Api\ContainerItemController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FabricRollController;
use App\Http\Controllers\Api\FabricTypeController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\SaleFormController;
use App\Http\Controllers\Api\SecretaireController;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::get('/settings/branding', [CompanySettingsController::class, 'branding']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateProfile']);

    Route::middleware('role:admin,secretaire,comptable')->group(function () {
        Route::post('ai/chat', [AiController::class, 'chat']);
        Route::get('ai/clients/{client}/summary', [AiController::class, 'clientSummary']);
    });

    Route::middleware('role:admin,secretaire')->group(function () {
        Route::post('ai/pricing-hint', [AiController::class, 'pricingHint']);
    });

    // Finance — factures & paiements (tous les rôles opérationnels)
    Route::middleware('role:admin,secretaire,comptable')->group(function () {
        Route::get('/comptable/dashboard', [ComptableController::class, 'dashboard']);

        Route::get('payments', [PaymentController::class, 'index']);
        Route::post('payments', [PaymentController::class, 'store']);
    });

    Route::middleware('role:admin,comptable,secretaire')->group(function () {
        Route::get('payments/{payment}/proof', [PaymentController::class, 'proof']);
    });

    Route::middleware('role:admin,secretaire')->group(function () {
        Route::get('invoices/sales-for-invoice', [InvoiceController::class, 'salesForInvoice']);
    });

    Route::middleware('role:admin,secretaire,comptable')->group(function () {
        Route::get('invoices', [InvoiceController::class, 'index']);
        Route::get('invoices/{invoice}/pdf', [InvoiceController::class, 'downloadPdf']);
        Route::get('invoices/{invoice}', [InvoiceController::class, 'show']);

        Route::get('clients', [ClientController::class, 'index']);
        Route::get('clients/{client}', [ClientController::class, 'show']);
    });

    // Secrétaire + Admin
    Route::middleware('role:admin,secretaire')->group(function () {
        Route::get('/secretaire/dashboard', [SecretaireController::class, 'dashboard']);

        Route::apiResource('containers', ContainerController::class);
        Route::post('containers/{container}/items', [ContainerItemController::class, 'store']);
        Route::put('container-items/{containerItem}', [ContainerItemController::class, 'update']);
        Route::delete('container-items/{containerItem}', [ContainerItemController::class, 'destroy']);

        Route::post('clients', [ClientController::class, 'store']);
        Route::put('clients/{client}', [ClientController::class, 'update']);

        Route::post('invoices', [InvoiceController::class, 'store']);
        Route::put('invoices/{invoice}', [InvoiceController::class, 'update']);

        Route::get('fabric-types', [FabricTypeController::class, 'index']);
        Route::post('fabric-types', [FabricTypeController::class, 'store']);
        Route::put('fabric-types/{fabric_type}', [FabricTypeController::class, 'update']);

        Route::get('sales/form-options', [SaleFormController::class, 'formOptions']);
        Route::get('sales/stock-availability', [SaleFormController::class, 'stockAvailability']);
        Route::get('sales/pricing-basis', [SaleFormController::class, 'pricingBasis']);
        Route::get('sales', [SaleController::class, 'index']);
        Route::post('sales', [SaleController::class, 'store']);
        Route::get('sales/{sale}', [SaleController::class, 'show']);
        Route::put('sales/{sale}', [SaleController::class, 'update']);
        Route::delete('sales/{sale}', [SaleController::class, 'destroy']);

        Route::post('fabric-rolls', [FabricRollController::class, 'store']);

        Route::get('stock', [StockController::class, 'index']);
        Route::get('stock/rolls', [StockController::class, 'rolls']);
    });

    // Admin only
    Route::middleware('role:admin')->group(function () {
        Route::get('/settings/company', [CompanySettingsController::class, 'show']);
        Route::put('/settings/company', [CompanySettingsController::class, 'update']);
        Route::post('/settings/company/logo', [CompanySettingsController::class, 'uploadLogo']);

        Route::get('/dashboard', [DashboardController::class, 'index']);

        Route::delete('fabric-types/{fabric_type}', [FabricTypeController::class, 'destroy']);

        Route::delete('clients/{client}', [ClientController::class, 'destroy']);

        Route::get('fabric-rolls', [FabricRollController::class, 'index']);

        Route::get('users', [UserController::class, 'index']);
        Route::post('users', [UserController::class, 'store']);
        Route::put('users/{user}', [UserController::class, 'update']);
        Route::delete('users/{user}', [UserController::class, 'destroy']);

        Route::get('activity-logs', [ActivityLogController::class, 'index']);
    });
});
