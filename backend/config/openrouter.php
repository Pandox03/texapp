<?php

return [
    'api_key' => env('OPENROUTER_API_KEY'),
    'base_url' => env('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
    'model' => env('OPENROUTER_MODEL', 'google/gemini-2.5-flash'),
    'max_tokens' => (int) env('OPENROUTER_MAX_TOKENS', 2048),
    'timeout' => (int) env('OPENROUTER_TIMEOUT', 90),
    'connect_timeout' => (int) env('OPENROUTER_CONNECT_TIMEOUT', 30),
    'site_url' => env('OPENROUTER_SITE_URL', env('APP_URL')),
    'site_name' => env('OPENROUTER_SITE_NAME', env('APP_NAME', 'TexFlow')),
];
