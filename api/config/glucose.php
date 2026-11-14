<?php

/*
 * Faixas glicêmicas (mg/dL) usadas para classificar leituras e calcular
 * tempo no alvo. Valores padrão seguem o consenso internacional de TIR.
 */
return [
    'ranges' => [
        'very_low' => (int) env('GLUCOSE_VERY_LOW', 54),
        'low' => (int) env('GLUCOSE_LOW', 70),
        'high' => (int) env('GLUCOSE_HIGH', 180),
        'very_high' => (int) env('GLUCOSE_VERY_HIGH', 250),
    ],

    /* Limite de leituras aceitas por requisição de importação. */
    'import_max_readings' => 2000,
];
