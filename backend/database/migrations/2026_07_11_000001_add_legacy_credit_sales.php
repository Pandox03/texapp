<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->string('sale_type', 20)->default('stock')->after('reference');
        });

        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropForeign(['fabric_roll_id']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE sale_items MODIFY fabric_roll_id BIGINT UNSIGNED NULL');
        } else {
            Schema::table('sale_items', function (Blueprint $table) {
                $table->unsignedBigInteger('fabric_roll_id')->nullable()->change();
            });
        }

        Schema::table('sale_items', function (Blueprint $table) {
            $table->foreign('fabric_roll_id')->references('id')->on('fabric_rolls')->cascadeOnDelete();
            $table->foreignId('fabric_type_id')->nullable()->after('fabric_roll_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('fabric_type_id');
            $table->dropForeign(['fabric_roll_id']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE sale_items MODIFY fabric_roll_id BIGINT UNSIGNED NOT NULL');
        } else {
            Schema::table('sale_items', function (Blueprint $table) {
                $table->unsignedBigInteger('fabric_roll_id')->nullable(false)->change();
            });
        }

        Schema::table('sale_items', function (Blueprint $table) {
            $table->foreign('fabric_roll_id')->references('id')->on('fabric_rolls')->cascadeOnDelete();
        });

        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn('sale_type');
        });
    }
};
