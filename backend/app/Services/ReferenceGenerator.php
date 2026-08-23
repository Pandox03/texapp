<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\Sale;

class ReferenceGenerator
{
    public function nextSaleReference(): string
    {
        return $this->nextSequential('VTE', Sale::class);
    }

    public function nextCreditReference(): string
    {
        return $this->nextSequential('CRD', Sale::class);
    }

    public function nextPaymentReference(): string
    {
        return $this->nextSequential('PAY', Payment::class);
    }

    /**
     * @param  class-string<Sale|Payment>  $modelClass
     */
    private function nextSequential(string $prefix, string $modelClass): string
    {
        $year = date('Y');
        $fullPrefix = "{$prefix}-{$year}-";

        /** @var Sale|Payment|null $last */
        $last = $modelClass::query()
            ->where('reference', 'like', $fullPrefix.'%')
            ->orderByDesc('reference')
            ->first();

        $next = 1;

        if ($last && preg_match('/(\d+)$/', $last->reference, $matches)) {
            $next = ((int) $matches[1]) + 1;
        }

        return $fullPrefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
