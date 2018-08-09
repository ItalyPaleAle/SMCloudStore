#!/bin/sh
docker run \
    -e "MINIO_ACCESS_KEY=8O683FBOQPTVBLX8T11M" \
    -e "MINIO_SECRET_KEY=ulTofsUnwmgnYLR8I6D4IbFD9N/NJ+XJ0X84bxrH" \
    -p 9001:9000 \
    --rm \
    minio/minio \
        server /data
