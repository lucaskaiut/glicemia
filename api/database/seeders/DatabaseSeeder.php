<?php

namespace Database\Seeders;

use App\Modules\Auth\DTOs\NewTenantData;
use App\Modules\Auth\DTOs\NewUserData;
use App\Modules\Auth\Services\AuthService;
use App\Modules\Tenant\Models\Tenant;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Conta de demonstração só em desenvolvimento — nunca em produção.
        if (! app()->environment('local', 'testing') || Tenant::query()->exists()) {
            return;
        }

        app(AuthService::class)->register(
            new NewTenantData(
                name: 'Glicemia',
                document: '11222333000181',
                email: 'contato@glicemia.localhost',
                phone: '41999999999',
                domain: 'glicemia.localhost',
            ),
            new NewUserData(
                name: 'Administrador',
                email: 'admin@glicemia.localhost',
                phone: '41999999999',
                document: '52998224725',
                password: 'password',
            ),
        );
    }
}
