<?php

require dirname(__DIR__).'/vendor/autoload.php';
$app = require dirname(__DIR__).'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$inv = App\Models\Invoice::with('sale')->latest('id')->first();
if (! $inv) {
    echo "NO_INVOICE\n";
    exit(1);
}

echo 'id='.$inv->id.' ref='.$inv->reference.PHP_EOL;

try {
    $pdf = app(App\Services\InvoicePdfService::class)->generate($inv);
    $out = $pdf->output();
    echo 'pdf_bytes='.strlen($out).PHP_EOL;
    echo 'ok'.PHP_EOL;
} catch (Throwable $e) {
    echo 'ERROR: '.$e->getMessage().PHP_EOL;
    echo $e->getFile().':'.$e->getLine().PHP_EOL;
    echo $e->getTraceAsString().PHP_EOL;
    exit(1);
}
