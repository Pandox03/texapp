<?php

namespace App\Services;

use App\Models\FabricRoll;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockReturn;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class StockReturnService
{
    public function __construct(private BillingService $billing) {}

    /**
     * @return array<int, array{fabric_type_id: int, fabric_type_name: string, unit: string, quantity_m2: float, roll_count: int}>
     */
    public function returnableLines(Sale $sale): array
    {
        if ($sale->sale_type !== 'stock' && $sale->sale_type !== null) {
            return [];
        }

        $sale->loadMissing(['items.fabricRoll.fabricType']);

        /** @var array<string, array{fabric_type_id: int, fabric_type_name: string, unit: string, quantity_m2: float, roll_count: int}> $byKey */
        $byKey = [];

        foreach ($sale->items as $item) {
            $roll = $item->fabricRoll;
            if (! $roll || $roll->status !== 'sold') {
                continue;
            }

            $typeId = (int) $roll->fabric_type_id;
            $unit = \App\Support\QuantityUnit::normalize($item->unit ?? $roll->unit);
            $key = $typeId.'|'.$unit;

            if (! isset($byKey[$key])) {
                $byKey[$key] = [
                    'fabric_type_id' => $typeId,
                    'fabric_type_name' => $roll->fabricType?->name ?? 'Tissu',
                    'unit' => $unit,
                    'quantity_m2' => 0.0,
                    'roll_count' => 0,
                ];
            }

            $byKey[$key]['quantity_m2'] = round($byKey[$key]['quantity_m2'] + (float) $item->quantity_m2, 2);
            $byKey[$key]['roll_count']++;
        }

        return array_values($byKey);
    }

    /**
     * Reverse sold rolls on a stock sale and register the stock return.
     * Stock available rises because sold rolls are removed (not because of a double inbound).
     *
     * @return array{retour: StockReturn, sale: Sale}
     */
    public function apply(
        Sale $sale,
        int $fabricTypeId,
        float $quantityM2,
        int $rollCount,
        ?int $userId,
        string $returnedAt,
        ?string $reason,
        ?string $notes,
        ?string $unit = null,
    ): array {
        if ($sale->sale_type !== 'stock' && $sale->sale_type !== null) {
            throw new InvalidArgumentException('Seules les ventes stock peuvent recevoir un retour.');
        }

        $quantityM2 = round($quantityM2, 2);
        if ($quantityM2 <= 0 || $rollCount < 1) {
            throw new InvalidArgumentException('Indiquez une quantité et au moins 1 rouleau à retourner.');
        }

        $unit = $unit !== null ? \App\Support\QuantityUnit::normalize($unit) : null;

        return DB::transaction(function () use ($sale, $fabricTypeId, $quantityM2, $rollCount, $userId, $returnedAt, $reason, $notes, $unit) {
            $sale->load(['items.fabricRoll', 'client', 'invoices']);

            $candidates = $sale->items
                ->filter(function (SaleItem $item) use ($fabricTypeId, $unit) {
                    $roll = $item->fabricRoll;

                    if (! $roll || $roll->status !== 'sold' || (int) $roll->fabric_type_id !== $fabricTypeId) {
                        return false;
                    }

                    if ($unit === null) {
                        return true;
                    }

                    return \App\Support\QuantityUnit::normalize($item->unit ?? $roll->unit) === $unit;
                })
                ->sortByDesc('id')
                ->values();

            $availableQty = round((float) $candidates->sum(fn (SaleItem $i) => (float) $i->quantity_m2), 2);
            $availableRolls = $candidates->count();
            $resolvedUnit = $unit ?? \App\Support\QuantityUnit::normalize(
                $candidates->first()?->unit ?? $candidates->first()?->fabricRoll?->unit
            );

            if ($rollCount > $availableRolls) {
                throw new InvalidArgumentException(sprintf(
                    'Retour impossible : %d rouleau(x) restant(s) sur cette vente pour cet article, demandé %d.',
                    $availableRolls,
                    $rollCount,
                ));
            }

            if ($quantityM2 > $availableQty + 0.01) {
                throw new InvalidArgumentException(sprintf(
                    'Retour impossible : %s %s restant(s) sur cette vente pour cet article, demandé %s %s.',
                    number_format($availableQty, 2, ',', ' '),
                    \App\Support\QuantityUnit::label($resolvedUnit),
                    number_format($quantityM2, 2, ',', ' '),
                    \App\Support\QuantityUnit::label($resolvedUnit),
                ));
            }

            $toRemove = $this->selectItemsToRemove($candidates, $rollCount, $quantityM2);
            $removedQty = 0.0;
            $removedRolls = 0;
            $removedAmount = 0.0;

            foreach ($toRemove as $item) {
                $removedQty = round($removedQty + (float) $item->quantity_m2, 2);
                $removedAmount = round($removedAmount + (float) $item->line_total, 2);
                $removedRolls++;

                $rollId = $item->fabric_roll_id;
                $item->delete();
                if ($rollId) {
                    FabricRoll::query()->where('id', $rollId)->delete();
                }
            }

            $sale->refresh();
            $newTotal = round((float) $sale->items()->sum('line_total'), 2);
            $sale->update(['total_amount' => $newTotal]);

            $this->billing->reconcileSaleInvoicesAfterAmountChange($sale->fresh(['invoices', 'client']));

            $retour = StockReturn::create([
                'fabric_type_id' => $fabricTypeId,
                'client_id' => $sale->client_id,
                'sale_id' => $sale->id,
                'user_id' => $userId,
                'quantity_m2' => $removedQty,
                'unit' => $resolvedUnit,
                'roll_count' => $removedRolls,
                'returned_at' => $returnedAt,
                'reason' => $reason,
                'notes' => $notes,
            ]);

            return [
                'retour' => $retour->load(['fabricType', 'client', 'sale', 'user']),
                'sale' => $sale->fresh(['client', 'items.fabricRoll.fabricType', 'invoices']),
                'removed_amount' => $removedAmount,
            ];
        });
    }

    /**
     * Return every remaining sold article on a stock sale in one transaction.
     *
     * @return array{retours: list<StockReturn>, sale: Sale, removed_amount: float}
     */
    public function applyFullSale(
        Sale $sale,
        ?int $userId,
        string $returnedAt,
        ?string $reason,
        ?string $notes,
    ): array {
        if ($sale->sale_type !== 'stock' && $sale->sale_type !== null) {
            throw new InvalidArgumentException('Seules les ventes stock peuvent recevoir un retour.');
        }

        return DB::transaction(function () use ($sale, $userId, $returnedAt, $reason, $notes) {
            $sale->load(['items.fabricRoll.fabricType', 'client', 'invoices']);

            $candidates = $sale->items
                ->filter(function (SaleItem $item) {
                    $roll = $item->fabricRoll;

                    return $roll && $roll->status === 'sold';
                })
                ->values();

            if ($candidates->isEmpty()) {
                throw new InvalidArgumentException('Aucun article restant à retourner sur cette vente.');
            }

            /** @var array<string, array{fabric_type_id: int, unit: string, items: list<SaleItem>, m2: float, rolls: int, amount: float}> $byKey */
            $byKey = [];

            foreach ($candidates as $item) {
                $typeId = (int) $item->fabricRoll->fabric_type_id;
                $unit = \App\Support\QuantityUnit::normalize($item->unit ?? $item->fabricRoll->unit);
                $key = $typeId.'|'.$unit;
                if (! isset($byKey[$key])) {
                    $byKey[$key] = [
                        'fabric_type_id' => $typeId,
                        'unit' => $unit,
                        'items' => [],
                        'm2' => 0.0,
                        'rolls' => 0,
                        'amount' => 0.0,
                    ];
                }
                $byKey[$key]['items'][] = $item;
                $byKey[$key]['m2'] = round($byKey[$key]['m2'] + (float) $item->quantity_m2, 2);
                $byKey[$key]['rolls']++;
                $byKey[$key]['amount'] = round($byKey[$key]['amount'] + (float) $item->line_total, 2);
            }

            $removedAmount = 0.0;
            $retours = [];

            foreach ($byKey as $group) {
                foreach ($group['items'] as $item) {
                    $rollId = $item->fabric_roll_id;
                    $item->delete();
                    if ($rollId) {
                        FabricRoll::query()->where('id', $rollId)->delete();
                    }
                }

                $removedAmount = round($removedAmount + $group['amount'], 2);

                $retours[] = StockReturn::create([
                    'fabric_type_id' => $group['fabric_type_id'],
                    'client_id' => $sale->client_id,
                    'sale_id' => $sale->id,
                    'user_id' => $userId,
                    'quantity_m2' => $group['m2'],
                    'unit' => $group['unit'],
                    'roll_count' => $group['rolls'],
                    'returned_at' => $returnedAt,
                    'reason' => $reason,
                    'notes' => $notes,
                ])->load(['fabricType', 'client', 'sale', 'user']);
            }

            $sale->refresh();
            $sale->update(['total_amount' => round((float) $sale->items()->sum('line_total'), 2)]);
            $this->billing->reconcileSaleInvoicesAfterAmountChange($sale->fresh(['invoices', 'client']));

            return [
                'retours' => $retours,
                'sale' => $sale->fresh(['client', 'items.fabricRoll.fabricType', 'invoices']),
                'removed_amount' => $removedAmount,
            ];
        });
    }

    /**
     * @param  \Illuminate\Support\Collection<int, SaleItem>  $candidates
     * @return list<SaleItem>
     */
    private function selectItemsToRemove($candidates, int $rollCount, float $quantityM2): array
    {
        // Prefer exact roll_count whole rolls whose m² sums closest to requested (greedy from newest).
        $selected = [];
        $m2 = 0.0;

        foreach ($candidates as $item) {
            if (count($selected) >= $rollCount) {
                break;
            }
            $selected[] = $item;
            $m2 = round($m2 + (float) $item->quantity_m2, 2);
        }

        if (count($selected) < $rollCount) {
            throw new InvalidArgumentException('Pas assez de rouleaux à retourner sur cette vente.');
        }

        // If selected m² is less than requested, keep adding more rolls if available
        if ($m2 + 0.01 < $quantityM2) {
            foreach ($candidates as $item) {
                if (in_array($item, $selected, true)) {
                    continue;
                }
                $selected[] = $item;
                $m2 = round($m2 + (float) $item->quantity_m2, 2);
                if ($m2 + 0.01 >= $quantityM2) {
                    break;
                }
            }
        }

        if ($m2 + 0.01 < $quantityM2) {
            throw new InvalidArgumentException('Pas assez de m² à retourner sur cette vente.');
        }

        // If we overshot badly with exact roll_count, still OK — returning whole rolls only.
        return $selected;
    }
}
