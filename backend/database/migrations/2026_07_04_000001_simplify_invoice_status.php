<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE invoices MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'sent'");
        }

        DB::table('invoices')->where('status', 'paid')->update(['status' => 'paid']);
        DB::table('invoices')->where('status', 'sent')->update(['status' => 'sent']);
        DB::table('invoices')->whereNotIn('status', ['sent', 'paid'])->update(['status' => 'unpaid']);
    }

    public function down(): void
    {
        DB::table('invoices')->where('status', 'unpaid')->update(['status' => 'overdue']);

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE invoices MODIFY COLUMN status ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled') NOT NULL DEFAULT 'sent'");
        }
    }
};
