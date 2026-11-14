<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Códigos de autorização de uso único do app desktop (OAuth para apps nativos,
 * RFC 8252 + PKCE/RFC 7636). Guardamos só o hash do código.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reader_authorizations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('code_hash', 64)->unique();
            $table->string('code_challenge', 128);
            $table->string('redirect_uri', 255);
            $table->string('device_name', 120)->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reader_authorizations');
    }
};
