<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * O relógio de um glicosímetro pode mudar (pilha, ajuste manual) e até voltar no tempo,
 * então o ajuste de relógio passa a valer por período. Um período começa numa posição
 * da memória do aparelho (device_sequence: 1 = medição mais antiga já vista).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('glucose_readings', function (Blueprint $table) {
            $table->unsignedInteger('device_sequence')->nullable()->after('device_measured_at');
            $table->index(['glucose_device_id', 'device_sequence']);
        });

        Schema::table('glucose_devices', function (Blueprint $table) {
            $table->json('clock_offsets')->nullable()->after('clock_offset_seconds');
        });

        // Dados existentes: a ordem da memória coincide com a ordem do horário do aparelho.
        DB::table('glucose_devices')->orderBy('id')->each(function ($device): void {
            $seq = 0;
            DB::table('glucose_readings')
                ->where('glucose_device_id', $device->id)
                ->orderBy('device_measured_at')
                ->orderBy('id')
                ->select(['id'])
                ->each(function ($reading) use (&$seq): void {
                    DB::table('glucose_readings')->where('id', $reading->id)->update(['device_sequence' => ++$seq]);
                });

            DB::table('glucose_devices')->where('id', $device->id)->update([
                'clock_offsets' => json_encode([['from_sequence' => 1, 'offset_seconds' => (int) $device->clock_offset_seconds]]),
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('glucose_readings', function (Blueprint $table) {
            $table->dropIndex(['glucose_device_id', 'device_sequence']);
            $table->dropColumn('device_sequence');
        });

        Schema::table('glucose_devices', function (Blueprint $table) {
            $table->dropColumn('clock_offsets');
        });
    }
};
