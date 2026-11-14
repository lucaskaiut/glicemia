<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('glucose_readings', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('glucose_device_id')->nullable()->constrained('glucose_devices')->nullOnDelete();
            /* Horário já corrigido (relógio do aparelho + ajuste), em hora local. */
            $table->dateTime('measured_at');
            /* Horário exatamente como o aparelho registrou. Nulo em leituras manuais. */
            $table->dateTime('device_measured_at')->nullable();
            $table->unsignedSmallInteger('value_mg_dl');
            $table->unsignedTinyInteger('meal_tag')->default(0);
            $table->string('source', 20)->default('device');
            $table->string('notes', 500)->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'measured_at']);
            $table->unique(['tenant_id', 'glucose_device_id', 'device_measured_at', 'value_mg_dl'], 'glucose_readings_dedup_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('glucose_readings');
    }
};
