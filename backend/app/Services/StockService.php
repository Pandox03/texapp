<?php

namespace App\Services;

use App\Models\ContainerItem;
use App\Models\FabricRoll;
use App\Models\FabricType;
use App\Models\StockReturn;
use App\Support\QuantityUnit;
use InvalidArgumentException;

class StockService
{
    /**
     * Stock math is always in m² equivalent. Line quantities may be m² or kg (via GSM).
     *
     * @return array<int, array{
     *     fabric_type_id: int,
     *     unit: string,
     *     total_m2: float,
     *     sold_m2: float,
     *     available_m2: float,
     *     returned_m2: float,
     *     total_kg: float|null,
     *     sold_kg: float|null,
     *     available_kg: float|null,
     *     returned_kg: float|null,
     *     total_rolls: int,
     *     sold_rolls: int,
     *     available_rolls: int,
     *     returned_rolls: int
     * }>
     */
    public function globalStockLines(): array
    {
        $types = FabricType::query()->get()->keyBy('id');
        $incoming = $this->incomingM2ByFabricType($types);
        $returns = $this->returnsM2ByFabricType($types);
        $sold = $this->soldM2ByFabricType($types);

        $typeIds = collect($incoming->keys())
            ->merge($returns->keys())
            ->merge($sold->keys())
            ->unique()
            ->sort()
            ->values();

        $lines = [];

        foreach ($typeIds as $fabricTypeId) {
            $fabricTypeId = (int) $fabricTypeId;
            $fabric = $types->get($fabricTypeId);
            $totalM2 = round((float) ($incoming->get($fabricTypeId)?->total_m2 ?? 0), 2);
            $totalRolls = (int) ($incoming->get($fabricTypeId)?->total_rolls ?? 0);
            $returnedM2 = round((float) ($returns->get($fabricTypeId)?->total_m2 ?? 0), 2);
            $returnedRolls = (int) ($returns->get($fabricTypeId)?->total_rolls ?? 0);
            $soldM2 = round((float) ($sold->get($fabricTypeId)?->sold_m2 ?? 0), 2);
            $soldRolls = (int) ($sold->get($fabricTypeId)?->sold_rolls ?? 0);

            if ($totalM2 <= 0 && $soldM2 <= 0 && $returnedM2 <= 0) {
                continue;
            }

            $availableM2 = round(max(0, $totalM2 - $soldM2), 2);
            $gsm = $fabric?->default_gsm ? (int) $fabric->default_gsm : null;

            $lines[] = [
                'fabric_type_id' => $fabricTypeId,
                'unit' => QuantityUnit::normalize($fabric?->unit),
                'total_m2' => $totalM2,
                'sold_m2' => $soldM2,
                'available_m2' => $availableM2,
                'returned_m2' => $returnedM2,
                'total_kg' => $this->tryToKg($totalM2, $gsm),
                'sold_kg' => $this->tryToKg($soldM2, $gsm),
                'available_kg' => $this->tryToKg($availableM2, $gsm),
                'returned_kg' => $this->tryToKg($returnedM2, $gsm),
                'total_rolls' => $totalRolls,
                'sold_rolls' => $soldRolls,
                'available_rolls' => $this->resolveAvailableRolls($fabricTypeId, $totalRolls, $soldRolls, $availableM2, $fabric),
                'returned_rolls' => $returnedRolls,
            ];
        }

        return $lines;
    }

    public function globalSummary(): array
    {
        $lines = $this->globalStockLines();
        $totalM2 = 0.0;
        $soldM2 = 0.0;
        $availableM2 = 0.0;
        $returnedM2 = 0.0;
        $totalKg = 0.0;
        $soldKg = 0.0;
        $availableKg = 0.0;
        $returnedKg = 0.0;
        $hasKg = false;

        foreach ($lines as $line) {
            $totalM2 = round($totalM2 + $line['total_m2'], 2);
            $soldM2 = round($soldM2 + $line['sold_m2'], 2);
            $availableM2 = round($availableM2 + $line['available_m2'], 2);
            $returnedM2 = round($returnedM2 + $line['returned_m2'], 2);

            if ($line['available_kg'] !== null) {
                $hasKg = true;
                $totalKg = round($totalKg + (float) $line['total_kg'], 2);
                $soldKg = round($soldKg + (float) $line['sold_kg'], 2);
                $availableKg = round($availableKg + (float) $line['available_kg'], 2);
                $returnedKg = round($returnedKg + (float) $line['returned_kg'], 2);
            }
        }

        $totalRolls = (int) ContainerItem::sum('estimated_rolls');
        $returnedRolls = (int) StockReturn::sum('roll_count');
        $soldRolls = FabricRoll::where('status', 'sold')->count();

        return [
            'total_m2' => $totalM2,
            'returned_m2' => $returnedM2,
            'sold_m2' => $soldM2,
            'available_m2' => $availableM2,
            'total_kg' => $hasKg ? $totalKg : 0.0,
            'returned_kg' => $hasKg ? $returnedKg : 0.0,
            'sold_kg' => $hasKg ? $soldKg : 0.0,
            'available_kg' => $hasKg ? $availableKg : 0.0,
            'total_rolls' => $totalRolls,
            'returned_rolls' => $returnedRolls,
            'sold_rolls' => $soldRolls,
            'available_rolls' => max(0, $totalRolls - $soldRolls),
            'available_fabric_rolls' => FabricRoll::where('status', 'available')->count(),
            'lines_count' => count($lines),
        ];
    }

    /**
     * @return array{
     *     found: bool,
     *     fabric_type_id: int,
     *     fabric_type_name?: string,
     *     unit: string,
     *     gsm: int|null,
     *     available_m2: float,
     *     available_kg: float|null,
     *     total_m2: float,
     *     sold_m2: float,
     *     returned_m2: float,
     *     total_rolls: int,
     *     sold_rolls: int,
     *     available_rolls: int,
     *     returned_rolls: int,
     *     avg_m2_per_roll: float
     * }
     */
    public function availability(int $fabricTypeId): array
    {
        $fabricType = FabricType::query()->find($fabricTypeId);
        $gsm = $fabricType?->default_gsm ? (int) $fabricType->default_gsm : null;
        $types = collect([$fabricTypeId => $fabricType])->filter();

        $incoming = $this->incomingM2ByFabricType($types)->get($fabricTypeId);
        $returns = $this->returnsM2ByFabricType($types)->get($fabricTypeId);
        $sold = $this->soldM2ByFabricType($types)->get($fabricTypeId);

        $totalM2 = round((float) ($incoming?->total_m2 ?? 0), 2);
        $returnedM2 = round((float) ($returns?->total_m2 ?? 0), 2);
        $soldM2 = round((float) ($sold?->sold_m2 ?? 0), 2);
        $totalRolls = (int) ($incoming?->total_rolls ?? 0);
        $returnedRolls = (int) ($returns?->total_rolls ?? 0);
        $soldRolls = (int) ($sold?->sold_rolls ?? 0);
        $availableM2 = round(max(0, $totalM2 - $soldM2), 2);

        if ($totalM2 <= 0) {
            return [
                'found' => false,
                'fabric_type_id' => $fabricTypeId,
                'fabric_type_name' => $fabricType?->name,
                'unit' => QuantityUnit::normalize($fabricType?->unit),
                'gsm' => $gsm,
                'available_m2' => 0,
                'available_kg' => $this->tryToKg(0, $gsm),
                'total_m2' => 0,
                'sold_m2' => 0,
                'returned_m2' => $returnedM2,
                'total_rolls' => 0,
                'sold_rolls' => 0,
                'available_rolls' => 0,
                'returned_rolls' => $returnedRolls,
                'avg_m2_per_roll' => 0,
            ];
        }

        return [
            'found' => true,
            'fabric_type_id' => $fabricTypeId,
            'fabric_type_name' => $fabricType?->name,
            'unit' => QuantityUnit::normalize($fabricType?->unit),
            'gsm' => $gsm,
            'available_m2' => $availableM2,
            'available_kg' => $this->tryToKg($availableM2, $gsm),
            'total_m2' => $totalM2,
            'sold_m2' => $soldM2,
            'returned_m2' => $returnedM2,
            'total_rolls' => $totalRolls,
            'sold_rolls' => $soldRolls,
            'available_rolls' => $this->resolveAvailableRolls($fabricTypeId, $totalRolls, $soldRolls, $availableM2, $fabricType),
            'returned_rolls' => $returnedRolls,
            'avg_m2_per_roll' => $this->averageM2PerRoll($fabricTypeId, $totalM2, $totalRolls, $fabricType),
        ];
    }

    public function assertGlobalStockExists(int $fabricTypeId): void
    {
        $availability = $this->availability($fabricTypeId);

        if (! $availability['found']) {
            throw new InvalidArgumentException(sprintf(
                'Aucun stock enregistré pour %s. Enregistrez d\'abord un achat ou un retour.',
                $availability['fabric_type_name'] ?? 'tissu',
            ));
        }
    }

    /**
     * @param  array<int, array{fabric_type_id: int, roll_count: int, quantity_m2?: float, unit?: string}>  $lines
     */
    public function assertSufficientStockForSaleLines(array $lines): void
    {
        /** @var array<int, array{fabric_type_id: int, roll_count: int, quantity_m2: float}> $pendingByType */
        $pendingByType = [];
        $errors = [];

        foreach ($lines as $line) {
            $typeId = (int) $line['fabric_type_id'];
            $fabric = FabricType::query()->find($typeId);
            $gsm = $fabric?->default_gsm ? (int) $fabric->default_gsm : null;
            $unit = QuantityUnit::normalize($line['unit'] ?? null);
            $qty = isset($line['quantity_m2']) ? round((float) $line['quantity_m2'], 2) : 0.0;

            try {
                $qtyM2 = QuantityUnit::toM2($qty, $unit, $gsm);
            } catch (InvalidArgumentException $e) {
                $errors[] = sprintf('%s : %s', $fabric?->name ?? 'tissu', $e->getMessage());

                continue;
            }

            if (! isset($pendingByType[$typeId])) {
                $pendingByType[$typeId] = [
                    'fabric_type_id' => $typeId,
                    'roll_count' => 0,
                    'quantity_m2' => 0.0,
                ];
            }

            $pendingByType[$typeId]['roll_count'] += (int) $line['roll_count'];
            $pendingByType[$typeId]['quantity_m2'] += $qtyM2;
        }

        foreach ($pendingByType as $entry) {
            $availability = $this->availability($entry['fabric_type_id']);
            $requestedRolls = $entry['roll_count'];
            $requestedM2 = round($entry['quantity_m2'], 2);

            if (! $availability['found']) {
                $errors[] = sprintf(
                    'Aucun stock enregistré pour %s.',
                    $availability['fabric_type_name'] ?? 'tissu',
                );

                continue;
            }

            if ($requestedRolls > $availability['available_rolls']) {
                $errors[] = sprintf(
                    'Stock insuffisant pour %s : %d rouleau(x) disponible(s), vente demandée %d rouleau(x).',
                    $availability['fabric_type_name'] ?? 'tissu',
                    $availability['available_rolls'],
                    $requestedRolls,
                );
            }

            if ($requestedM2 > $availability['available_m2'] + 0.01) {
                $gsm = $availability['gsm'];
                $availLabel = $availability['available_m2'].' m²';
                $reqLabel = $requestedM2.' m²';
                if ($gsm) {
                    $availLabel .= ' / '.$availability['available_kg'].' kg';
                    $reqLabel .= ' / '.QuantityUnit::toKg($requestedM2, QuantityUnit::M2, $gsm).' kg';
                }
                $errors[] = sprintf(
                    'Stock insuffisant pour %s : disponible %s, vente demandée %s.',
                    $availability['fabric_type_name'] ?? 'tissu',
                    $availLabel,
                    $reqLabel,
                );
            }
        }

        if ($errors !== []) {
            throw new InvalidArgumentException(implode("\n", $errors));
        }
    }

    public function rollLineLabel(FabricRoll $roll): string
    {
        $roll->loadMissing('fabricType');

        return $roll->fabricType?->name ?? 'Tissu';
    }

    /**
     * @param  \Illuminate\Support\Collection<int, FabricType|null>  $types
     * @return \Illuminate\Support\Collection<int, object{total_m2: float, total_rolls: int}>
     */
    private function incomingM2ByFabricType($types)
    {
        $items = ContainerItem::query()->with('fabricType')->get();
        $grouped = [];

        foreach ($items as $item) {
            $typeId = (int) $item->fabric_type_id;
            $fabric = $types->get($typeId) ?? $item->fabricType;
            $gsm = $fabric?->default_gsm ? (int) $fabric->default_gsm : null;

            try {
                $m2 = QuantityUnit::toM2((float) $item->quantity_m2, $item->unit ?? QuantityUnit::M2, $gsm);
            } catch (InvalidArgumentException) {
                // Treat unconvertible kg as 0 for aggregate (validation blocks new bad rows).
                $m2 = QuantityUnit::normalize($item->unit ?? null) === QuantityUnit::M2
                    ? (float) $item->quantity_m2
                    : 0.0;
            }

            if (! isset($grouped[$typeId])) {
                $grouped[$typeId] = (object) ['total_m2' => 0.0, 'total_rolls' => 0];
            }
            $grouped[$typeId]->total_m2 = round($grouped[$typeId]->total_m2 + $m2, 2);
            $grouped[$typeId]->total_rolls += (int) ($item->estimated_rolls ?? 0);
        }

        return collect($grouped);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, FabricType|null>  $types
     * @return \Illuminate\Support\Collection<int, object{total_m2: float, total_rolls: int}>
     */
    private function returnsM2ByFabricType($types)
    {
        $rows = StockReturn::query()->with('fabricType')->get();
        $grouped = [];

        foreach ($rows as $row) {
            $typeId = (int) $row->fabric_type_id;
            $fabric = $types->get($typeId) ?? $row->fabricType;
            $gsm = $fabric?->default_gsm ? (int) $fabric->default_gsm : null;

            try {
                $m2 = QuantityUnit::toM2((float) $row->quantity_m2, $row->unit ?? QuantityUnit::M2, $gsm);
            } catch (InvalidArgumentException) {
                $m2 = QuantityUnit::normalize($row->unit ?? null) === QuantityUnit::M2
                    ? (float) $row->quantity_m2
                    : 0.0;
            }

            if (! isset($grouped[$typeId])) {
                $grouped[$typeId] = (object) ['total_m2' => 0.0, 'total_rolls' => 0];
            }
            $grouped[$typeId]->total_m2 = round($grouped[$typeId]->total_m2 + $m2, 2);
            $grouped[$typeId]->total_rolls += (int) ($row->roll_count ?? 0);
        }

        return collect($grouped);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, FabricType|null>  $types
     * @return \Illuminate\Support\Collection<int, object{sold_m2: float, sold_rolls: int}>
     */
    private function soldM2ByFabricType($types)
    {
        $rolls = FabricRoll::query()->where('status', 'sold')->with('fabricType')->get();
        $grouped = [];

        foreach ($rolls as $roll) {
            $typeId = (int) $roll->fabric_type_id;
            $fabric = $types->get($typeId) ?? $roll->fabricType;
            $gsm = $roll->gsm ?: ($fabric?->default_gsm ? (int) $fabric->default_gsm : null);

            try {
                $m2 = QuantityUnit::toM2((float) $roll->quantity_m2, $roll->unit ?? QuantityUnit::M2, $gsm ? (int) $gsm : null);
            } catch (InvalidArgumentException) {
                $m2 = QuantityUnit::normalize($roll->unit ?? null) === QuantityUnit::M2
                    ? (float) $roll->quantity_m2
                    : 0.0;
            }

            if (! isset($grouped[$typeId])) {
                $grouped[$typeId] = (object) ['sold_m2' => 0.0, 'sold_rolls' => 0];
            }
            $grouped[$typeId]->sold_m2 = round($grouped[$typeId]->sold_m2 + $m2, 2);
            $grouped[$typeId]->sold_rolls++;
        }

        return collect($grouped);
    }

    private function tryToKg(float $m2, ?int $gsm): ?float
    {
        if (! $gsm || $gsm < 1) {
            return null;
        }

        return QuantityUnit::toKg($m2, QuantityUnit::M2, $gsm);
    }

    private function resolveAvailableRolls(
        int $fabricTypeId,
        int $totalRolls,
        int $soldRolls,
        float $availableM2,
        ?FabricType $fabricType,
    ): int {
        if ($totalRolls > 0) {
            return max(0, $totalRolls - $soldRolls);
        }

        if ($availableM2 <= 0) {
            return 0;
        }

        $avg = $this->averageM2PerRoll($fabricTypeId, null, null, $fabricType);

        return max(0, (int) floor($availableM2 / max(0.01, $avg)));
    }

    private function averageM2PerRoll(
        int $fabricTypeId,
        ?float $totalM2 = null,
        ?int $totalRolls = null,
        ?FabricType $fabricType = null,
    ): float {
        $fabricType ??= FabricType::query()->find($fabricTypeId);

        if ($totalM2 !== null && $totalRolls !== null && $totalRolls > 0 && $totalM2 > 0) {
            return round($totalM2 / $totalRolls, 2);
        }

        $widthCm = (int) ($fabricType?->default_width_cm ?? 150);

        return round(($widthCm / 100) * 50, 2);
    }
}
