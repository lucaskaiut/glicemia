<?php

namespace App\Modules\Glucose\Enums;

/**
 * Marcação de refeição. Os códigos 0/1/2 são os mesmos que o OK Meter Match II
 * envia no último campo de cada registro.
 */
enum MealTag: int
{
    case NONE = 0;
    case BEFORE_MEAL = 1;
    case AFTER_MEAL = 2;

    public function label(): string
    {
        return match ($this) {
            self::NONE => 'Sem marcação',
            self::BEFORE_MEAL => 'Antes da refeição',
            self::AFTER_MEAL => 'Depois da refeição',
        };
    }

    public function key(): string
    {
        return match ($this) {
            self::NONE => 'none',
            self::BEFORE_MEAL => 'before_meal',
            self::AFTER_MEAL => 'after_meal',
        };
    }

    public static function fromKey(string $key): self
    {
        foreach (self::cases() as $case) {
            if ($case->key() === $key) {
                return $case;
            }
        }

        return self::NONE;
    }

    /** @return list<string> */
    public static function keys(): array
    {
        return array_map(fn (self $c) => $c->key(), self::cases());
    }
}
