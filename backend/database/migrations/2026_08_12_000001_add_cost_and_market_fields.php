<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('containers', function (Blueprint $table) {
            $table->decimal('purchase_cost_mad', 12, 2)->nullable()->after('notes');
            $table->decimal('shipping_cost_mad', 12, 2)->nullable()->after('purchase_cost_mad');
            $table->decimal('customs_fees_mad', 12, 2)->nullable()->after('shipping_cost_mad');
            $table->decimal('other_fees_mad', 12, 2)->nullable()->after('customs_fees_mad');
            $table->text('market_notes')->nullable()->after('other_fees_mad');
        });

        Schema::table('fabric_types', function (Blueprint $table) {
            $table->decimal('market_price_m2_mad', 12, 2)->nullable()->after('description');
            $table->decimal('target_margin_pct', 5, 2)->nullable()->default(25)->after('market_price_m2_mad');
        });
    }

    public function down(): void
    {
        Schema::table('containers', function (Blueprint $table) {
            $table->dropColumn([
                'purchase_cost_mad',
                'shipping_cost_mad',
                'customs_fees_mad',
                'other_fees_mad',
                'market_notes',
            ]);
        });

        Schema::table('fabric_types', function (Blueprint $table) {
            $table->dropColumn(['market_price_m2_mad', 'target_margin_pct']);
        });
    }
};
