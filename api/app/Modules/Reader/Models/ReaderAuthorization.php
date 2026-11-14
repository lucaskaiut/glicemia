<?php

namespace App\Modules\Reader\Models;

use App\Modules\Tenant\Models\Concerns\BelongsToTenant;
use App\Modules\User\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReaderAuthorization extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'user_id',
        'code_hash',
        'code_challenge',
        'redirect_uri',
        'device_name',
        'expires_at',
        'used_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
