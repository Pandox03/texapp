<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fabric_types', function (Blueprint $table) {
            $table->string('unit', 8)->default('m2')->after('default_gsm');
        });
    }

    public function down(): void
    {
        Schema::table('fabric_types', function (Blueprint $table) {
            $table->dropColumn('unit');
        });
    }
};
