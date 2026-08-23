<?php

namespace Tests\Unit;

use App\Services\BillingService;
use Tests\TestCase;

class BillingServiceTest extends TestCase
{
    private BillingService $billing;

    protected function setUp(): void
    {
        parent::setUp();
        $this->billing = app(BillingService::class);
    }

    public function test_split_ttc_at_default_rate(): void
    {
        $result = $this->billing->splitTtc(120.0, 20.0);

        $this->assertSame(100.0, $result['subtotal']);
        $this->assertSame(20.0, $result['tax_amount']);
        $this->assertSame(120.0, $result['total']);
        $this->assertSame(20.0, $result['tax_rate']);
    }

    public function test_split_ttc_rejects_negative_amounts(): void
    {
        $result = $this->billing->splitTtc(-50.0, 20.0);

        $this->assertSame(0.0, $result['total']);
        $this->assertSame(0.0, $result['subtotal']);
    }

    public function test_ht_from_ttc_matches_split(): void
    {
        $this->assertSame(83.33, $this->billing->htFromTtc(100.0, 20.0));
    }

    public function test_default_tax_rate_uses_company_config(): void
    {
        config(['company.tax_rate' => 10.0]);

        $this->assertSame(10.0, $this->billing->defaultTaxRate());
        $result = $this->billing->splitTtc(110.0);

        $this->assertSame(100.0, $result['subtotal']);
        $this->assertSame(10.0, $result['tax_amount']);
    }
}
