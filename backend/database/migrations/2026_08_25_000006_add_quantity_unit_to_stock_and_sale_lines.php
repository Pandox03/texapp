<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('container_items', function (Blueprint $table) {
            $table->string('unit', 8)->default('m2')->after('quantity_m2');
        });

        Schema::table('sale_items', function (Blueprint $table) {
            $table->string('unit', 8)->default('m2')->after('quantity_m2');
        });

        Schema::table('fabric_rolls', function (Blueprint $table) {
            $table->string('unit', 8)->default('m2')->after('quantity_m2');
        });

        Schema::table('stock_returns', function (Blueprint $table) {
            $table->string('unit', 8)->default('m2')->after('quantity_m2');
        });
    }

    public function down(): void
    {
        Schema::table('container_items', function (Blueprint $table) {
            $table->dropColumn('unit');
        });

        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropColumn('unit');
        });

        Schema::table('fabric_rolls', function (Blueprint $table) {
            $table->dropColumn('unit');
        });

        Schema::table('stock_returns', function (Blueprint $table) {
            $table->dropColumn('unit');
        });
    }
};
