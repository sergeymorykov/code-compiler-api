# Clang image for sandboxed compile+run. Non-root user.
# No official library/clang image on Docker Hub; use Debian + apt.
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    clang \
    coreutils \
    libstdc++-12-dev \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1000 runuser && useradd -u 1000 -g runuser -m -s /bin/sh runuser

WORKDIR /workspace
RUN chown runuser:runuser /workspace

USER runuser
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["echo 'Use exec to run compile/run'"]
