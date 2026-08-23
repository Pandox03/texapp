<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_settings', function (Blueprint $table) {
            $table->id();
            $table->string('app_name')->default('TexFlow');
            $table->string('tagline')->default('Import textile & gestion de stock');
            $table->string('legal_name')->default('Mon Entreprise');
            $table->string('legal_form')->default('SARL');
            $table->string('ice')->nullable();
            $table->string('rc')->nullable();
            $table->string('rc_city')->nullable();
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('country')->default('Maroc');
            $table->string('activity')->nullable();
            $table->string('capital')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('if_number')->nullable();
            $table->string('tp_number')->nullable();
            $table->string('cnss')->nullable();
            $table->string('currency', 8)->default('MAD');
            $table->decimal('tax_rate', 5, 2)->default(20);
            $table->unsignedSmallInteger('default_payment_terms_days')->default(30);
            $table->string('logo_path')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_settings');
    }
};
