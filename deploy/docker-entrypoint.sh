#!/bin/sh
set -eu
umask 077
mkdir -p /app/data
# A newly mounted persistent volume can be root-owned. Only the data mount is changed.
chown -R node:node /app/data
exec gosu node "$@"
