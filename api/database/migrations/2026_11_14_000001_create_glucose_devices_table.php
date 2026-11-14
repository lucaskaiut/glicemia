<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('glucose_devices', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('model', 80);
            $table->string('identifier', 120);
            $table->string('name', 120)->nullable();
            $table->integer('clock_offset_seconds')->default(0);
            $table->timestamp('last_synced_at')->nullable();
            $table->json('last_sync_result')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'model', 'identifier']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('glucose_devices');
    }
};
