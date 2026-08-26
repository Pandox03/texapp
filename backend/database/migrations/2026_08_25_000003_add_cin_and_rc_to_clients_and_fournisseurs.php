<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('cin', 50)->nullable()->after('ice_number');
            $table->string('rc', 50)->nullable()->after('cin');
        });

        Schema::table('fournisseurs', function (Blueprint $table) {
            $table->string('cin', 50)->nullable()->after('ice_number');
            $table->string('rc', 50)->nullable()->after('cin');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['cin', 'rc']);
        });

        Schema::table('fournisseurs', function (Blueprint $table) {
            $table->dropColumn(['cin', 'rc']);
        });
    }
};
