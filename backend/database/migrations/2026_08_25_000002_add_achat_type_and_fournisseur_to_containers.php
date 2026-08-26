<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('containers', function (Blueprint $table) {
            $table->string('type', 20)->default('container')->after('reference');
            $table->foreignId('fournisseur_id')
                ->nullable()
                ->after('type')
                ->constrained('fournisseurs')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('containers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('fournisseur_id');
            $table->dropColumn('type');
        });
    }
};
