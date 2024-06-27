#!/bin/bash

if [ "$#" -ne 3 ]; then
    echo "Usage: $0 NEW_USERNAME NEW_PASSWORD IS_NEW_SUPERUSER"
    exit 1
fi

curl -X POST http://localhost:8000/register \
-H "Content-Type: application/json" \
-d "{\"superuserName\":\"KOT\",\"superuserPassword\":\"KOT\",\"newUserUsername\":\"$1\",\"newUserPassword\":\"$2\",\"isNewUserSuper\":\"$3\"}"
